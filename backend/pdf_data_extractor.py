import json
import re

from ai_client import generate_text


DATA_SCHEMA = {
    "document_type": None,
    "invoice_number": None,
    "vendor": None,
    "customer": None,
    "date": None,
    "due_date": None,
    "currency": None,
    "subtotal": None,
    "tax": None,
    "total": None,
    "payment_status": None,
    "line_items": [],
    "custom_fields": {},
}


def _clean_json(raw_output: str) -> str:
    text = raw_output.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text).strip()
    return text


def _normalize_result(result: dict) -> dict:
    normalized = dict(DATA_SCHEMA)
    normalized.update(result)

    if not isinstance(normalized.get("line_items"), list):
        normalized["line_items"] = []

    if not isinstance(normalized.get("custom_fields"), dict):
        normalized["custom_fields"] = {}

    return normalized


def extract_structured_data(pages: list[dict]) -> dict:
    """Extract structured business/document data from PDF text using the AI client."""
    page_parts = []
    for page in pages:
        text = str(page.get("text", "")).strip()
        if text:
            page_parts.append(f"[Page {page.get('page')}]\n{text}")

    document_text = "\n\n".join(page_parts).strip()

    if not document_text:
        raise ValueError("No readable text was found in the PDF. Try OCR / Make Searchable first.")

    # Keep prompts bounded for large PDFs while preserving page references.
    max_chars = 30000
    if len(document_text) > max_chars:
        document_text = document_text[:max_chars]

    prompt = f"""
You are a strict document data extraction engine for MyToolbox AI.

Extract structured facts ONLY from the supplied document text.
Do not guess, infer missing values, or use outside knowledge.
If a value is not present or cannot be determined, return null.
For monetary values, return numbers when clearly available; otherwise return the original value as a string.
Keep line items as a list of objects with: description, quantity, unit_price, amount.
Use ISO-like dates (YYYY-MM-DD) only when the source makes the date unambiguous; otherwise preserve the source date string.
Put other useful named fields into custom_fields.

Return ONLY valid JSON matching this exact structure:
{{
  "document_type": "invoice | receipt | quote | purchase_order | statement | contract | report | other",
  "invoice_number": null,
  "vendor": null,
  "customer": null,
  "date": null,
  "due_date": null,
  "currency": null,
  "subtotal": null,
  "tax": null,
  "total": null,
  "payment_status": null,
  "line_items": [
    {{"description": null, "quantity": null, "unit_price": null, "amount": null}}
  ],
  "custom_fields": {{}}
}}

DOCUMENT TEXT:
{document_text}
"""

    raw_output = generate_text(prompt, json_output=True)

    try:
        result = json.loads(_clean_json(raw_output))
    except json.JSONDecodeError as exc:
        raise ValueError("AI returned invalid structured data. Please try the PDF again.") from exc

    if not isinstance(result, dict):
        raise ValueError("AI returned an invalid structured-data response.")

    return _normalize_result(result)
