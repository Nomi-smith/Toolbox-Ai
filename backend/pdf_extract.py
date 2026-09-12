import fitz


def extract_pdf_text(pdf_bytes: bytes) -> list[dict]:
    """
    Extract text from a PDF while preserving page numbers.

    Returns:
        A list containing extracted text for each page.
    """

    document = fitz.open(stream=pdf_bytes, filetype="pdf")

    pages = []

    try:
        for page_number, page in enumerate(document, start=1):
            text = page.get_text("text").strip()

            pages.append({
                "page": page_number,
                "text": text,
            })
    finally:
        document.close()

    return pages