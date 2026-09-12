import json
import re

from ai_client import generate_text


ALLOWED_TOOLS = {
    "remove_background": "Remove the background from an image.",
    "pdf_to_word": "Convert a PDF document into an editable Word document.",
    "pdf_extract_text": "Extract text from a PDF document.",
    "pdf_ask": "Answer a question about the contents of a PDF.",
}


def route_request(
    request: str,
    filename: str | None = None,
) -> dict:
    """
    Use the centralized AI client to decide which
    Toolbox AI tool should handle the user's request.

    The AI can only choose from the explicitly
    allowed tools.

    Gemini is tried first, with Groq automatically
    used as a fallback if Gemini hits a quota/rate limit.
    """

    tools_description = "\n".join(
        f"- {name}: {description}"
        for name, description in ALLOWED_TOOLS.items()
    )

    prompt = f"""
You are the routing brain for Toolbox AI.

Your job is ONLY to select the correct tool for
the user's request.

AVAILABLE TOOLS:

{tools_description}

USER REQUEST:

{request}

UPLOADED FILE:

{filename or "No file uploaded"}

Rules:

1. Select exactly ONE tool from the available tools.

2. Never invent a tool.

3. If the user wants to ask something about a PDF,
   choose pdf_ask.

4. If the user wants to convert a PDF to Word,
   choose pdf_to_word.

5. If the user wants text extracted from a PDF,
   choose pdf_extract_text.

6. If the user wants a background removed from an image,
   choose remove_background.

7. Consider both the user's request and uploaded file type.

8. Return ONLY valid JSON.

9. Do not include markdown.

10. The JSON must have exactly these fields:

{{
  "tool": "one of the available tool names",
  "reason": "short explanation",
  "confidence": 0.0
}}
"""

    raw_output = generate_text(
        prompt,
        json_output=True,
    )

    # Remove accidental markdown code fences.
    raw_output = re.sub(
        r"^```(?:json)?\s*|\s*```$",
        "",
        raw_output,
        flags=re.IGNORECASE,
    ).strip()

    try:
        result = json.loads(raw_output)

    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Router returned invalid JSON: {raw_output}"
        ) from exc

    if not isinstance(result, dict):
        raise RuntimeError(
            "Router returned an invalid response."
        )

    tool = result.get("tool")

    if tool not in ALLOWED_TOOLS:
        raise RuntimeError(
            f"Router selected an invalid tool: {tool}"
        )

    confidence = result.get(
        "confidence",
        0,
    )

    try:
        confidence = float(confidence)

    except (TypeError, ValueError):
        confidence = 0.0

    return {
        "tool": tool,
        "reason": result.get(
            "reason",
            "",
        ),
        "confidence": max(
            0.0,
            min(
                1.0,
                confidence,
            ),
        ),
    }