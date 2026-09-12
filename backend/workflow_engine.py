import json

from pdf_extract import extract_pdf_text
from pdf_tools import pdf_to_word
from rag_engine import answer_question
from ai_client import generate_text


ALLOWED_STEPS = {
    "pdf_to_word",
    "pdf_extract_text",
    "pdf_ask",
    "summarize_text",
}


def plan_workflow(
    request: str,
    filename: str | None = None,
) -> dict:
    """
    Ask the AI to convert a natural-language request
    into a short, controlled workflow.
    """

    prompt = f"""
You are the workflow planner for Toolbox AI.

Convert the user's request into a short,
controlled sequence of workflow steps.

AVAILABLE STEPS:

1. pdf_to_word
   Converts an uploaded PDF into a Word DOCX file.

2. pdf_extract_text
   Extracts text from an uploaded PDF.

3. pdf_ask
   Answers a question about an uploaded PDF using
   document-grounded AI.

4. summarize_text
   Summarizes text that has already been extracted.

RULES:

- Only use the available steps.
- Never invent a tool.
- Use the smallest number of steps necessary.
- Maximum 3 steps.
- Steps must be ordered logically.

For:
"Convert this PDF to Word and summarize it"

use:

pdf_to_word
pdf_extract_text
summarize_text

For:
"Extract the PDF text and answer a question"

use:

pdf_extract_text
pdf_ask

Return ONLY valid JSON.

Required format:

{{
  "steps": [
    {{
      "tool": "pdf_to_word",
      "reason": "short explanation"
    }}
  ]
}}

USER REQUEST:

{request}

FILENAME:

{filename or "none"}
"""

    raw_output = generate_text(
        prompt,
        json_output=True,
    )

    try:
        workflow = json.loads(raw_output)

    except json.JSONDecodeError as exc:
        raise ValueError(
            "AI workflow planner returned invalid JSON."
        ) from exc

    if not isinstance(workflow, dict):
        raise ValueError(
            "Invalid workflow planner response."
        )

    steps = workflow.get("steps")

    if not isinstance(steps, list):
        raise ValueError(
            "Workflow planner did not return a steps list."
        )

    if not steps:
        raise ValueError(
            "Workflow planner returned an empty workflow."
        )

    if len(steps) > 3:
        raise ValueError(
            "Workflow contains too many steps."
        )

    for step in steps:

        if not isinstance(step, dict):
            raise ValueError(
                "Invalid workflow step."
            )

        tool = step.get("tool")

        if tool not in ALLOWED_STEPS:
            raise ValueError(
                f"Workflow contains unsupported tool: {tool}"
            )

    return workflow


def summarize_text(
    text: str,
) -> str:

    if not text.strip():
        return (
            "No text was available to summarize."
        )

    prompt = f"""
Summarize the following document text.

Requirements:

- Focus on the main ideas.
- Keep the summary concise but useful.
- Use clear language.
- Do not invent information.
- Only use the supplied text.

DOCUMENT TEXT:

{text}
"""

    return generate_text(
        prompt
    )


def execute_workflow(
    request: str,
    file_bytes: bytes,
    filename: str | None = None,
) -> dict:

    workflow = plan_workflow(
        request=request,
        filename=filename,
    )

    steps = workflow["steps"]

    results = []

    pages = None
    extracted_text = ""
    word_file = None
    summary = None
    answer = None
    sources = []

    for index, step in enumerate(
        steps,
        start=1,
    ):

        tool = step["tool"]

        reason = step.get(
            "reason",
            "Workflow step selected by AI.",
        )

        if tool == "pdf_to_word":

            word_file = pdf_to_word(
                file_bytes
            )

            results.append({
                "step": index,
                "tool": tool,
                "status": "completed",
                "reason": reason,
            })

        elif tool == "pdf_extract_text":

            pages = extract_pdf_text(
                file_bytes
            )

            extracted_text = "\n\n".join(
                f"[Page {page['page']}]\n"
                f"{page['text']}"
                for page in pages
                if page["text"].strip()
            )

            results.append({
                "step": index,
                "tool": tool,
                "status": "completed",
                "reason": reason,
            })

        elif tool == "summarize_text":

            if not extracted_text:

                if pages is None:
                    pages = extract_pdf_text(
                        file_bytes
                    )

                extracted_text = "\n\n".join(
                    f"[Page {page['page']}]\n"
                    f"{page['text']}"
                    for page in pages
                    if page["text"].strip()
                )

            summary = summarize_text(
                extracted_text
            )

            results.append({
                "step": index,
                "tool": tool,
                "status": "completed",
                "reason": reason,
            })

        elif tool == "pdf_ask":

            if pages is None:
                pages = extract_pdf_text(
                    file_bytes
                )

            result = answer_question(
                question=request,
                pages=pages,
            )

            answer = result["answer"]
            sources = result["sources"]

            results.append({
                "step": index,
                "tool": tool,
                "status": "completed",
                "reason": reason,
            })

    return {
        "workflow": workflow,
        "steps": results,
        "summary": summary,
        "answer": answer,
        "sources": sources,
        "word_file": word_file,
        "extracted_text": extracted_text,
    }