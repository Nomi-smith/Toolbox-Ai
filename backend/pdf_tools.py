from io import BytesIO

import fitz
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.shared import Pt


def _is_footer_block(
    block: tuple,
    page_height: float,
) -> bool:
    """
    Detect text near the bottom of a PDF page.
    """

    y1 = block[3]

    return y1 > page_height - 45


def _clean_text(text: str) -> str:
    """
    Clean unnecessary whitespace while preserving
    readable paragraph structure.
    """

    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    return " ".join(lines).strip()


def _looks_like_bullet(text: str) -> bool:
    """
    Detect common bullet-point formats.
    """

    bullet_prefixes = (
        "• ",
        "● ",
        "▪ ",
        "◦ ",
        "- ",
        "– ",
        "* ",
    )

    return text.startswith(bullet_prefixes)


def _looks_like_heading(text: str) -> bool:
    """
    Detect common heading patterns used in documents.
    """

    if not text:
        return False

    # Numbered sections such as:
    # 1. Product Vision
    # 10. RAG Architecture
    if len(text) < 100:
        if text[:2].isdigit() and ". " in text[:5]:
            return True

        # Short ALL-CAPS headings.
        letters = [
            char
            for char in text
            if char.isalpha()
        ]

        if letters:
            uppercase_ratio = sum(
                char.isupper()
                for char in letters
            ) / len(letters)

            if uppercase_ratio > 0.75:
                return True

    return False


def _add_heading(
    document: Document,
    text: str,
    level: int = 1,
):
    paragraph = document.add_paragraph()

    paragraph.style = (
        "Heading 1"
        if level == 1
        else "Heading 2"
    )

    run = paragraph.add_run(text)

    run.bold = True
    run.font.size = Pt(
        15 if level == 1 else 13
    )

    paragraph.paragraph_format.space_before = Pt(8)
    paragraph.paragraph_format.space_after = Pt(4)

    return paragraph


def _add_body_paragraph(
    document: Document,
    text: str,
):
    paragraph = document.add_paragraph()

    paragraph.style = "Normal"

    paragraph.paragraph_format.space_after = Pt(5)
    paragraph.paragraph_format.line_spacing = 1.08

    run = paragraph.add_run(text)

    run.font.size = Pt(10.5)

    return paragraph


def _add_bullet(
    document: Document,
    text: str,
):
    paragraph = document.add_paragraph(
        style="List Bullet"
    )

    paragraph.paragraph_format.space_after = Pt(2)

    run = paragraph.add_run(
        text
    )

    run.font.size = Pt(10.5)

    return paragraph


def _add_table(
    document: Document,
    table_data: list[list[str]],
):
    if not table_data:
        return

    columns = max(
        len(row)
        for row in table_data
    )

    table = document.add_table(
        rows=0,
        cols=columns,
    )

    table.style = "Table Grid"

    for row_index, row_data in enumerate(
        table_data
    ):

        cells = table.add_row().cells

        for column_index in range(columns):

            value = ""

            if column_index < len(row_data):
                value = str(
                    row_data[column_index]
                )

            cells[column_index].text = value

            for paragraph in cells[
                column_index
            ].paragraphs:

                for run in paragraph.runs:
                    run.font.size = Pt(9.5)

                    if row_index == 0:
                        run.bold = True

    document.add_paragraph().paragraph_format.space_after = Pt(2)


def _extract_page_content(
    page: fitz.Page,
):
    """
    Extract text blocks while keeping their approximate
    reading order.
    """

    blocks = page.get_text(
        "blocks"
    )

    usable_blocks = []

    for block in blocks:

        if len(block) < 7:
            continue

        x0, y0, x1, y1, text, *_ = block

        text = text.strip()

        if not text:
            continue

        # Skip footer/page-number blocks.
        if _is_footer_block(
            block,
            page.rect.height,
        ):
            continue

        usable_blocks.append({
            "x0": x0,
            "y0": y0,
            "x1": x1,
            "y1": y1,
            "text": text,
        })

    usable_blocks.sort(
        key=lambda item: (
            item["y0"],
            item["x0"],
        )
    )

    return usable_blocks


def pdf_to_word(
    pdf_bytes: bytes,
) -> bytes:
    """
    Convert a PDF into a more structured editable DOCX.

    This converter uses PyMuPDF for layout-aware extraction
    and python-docx for creating the Word document.

    It attempts to preserve:

    - headings
    - paragraphs
    - bullet lists
    - numbered sections
    - tables
    - page breaks
    - basic formatting
    """

    pdf = fitz.open(
        stream=pdf_bytes,
        filetype="pdf",
    )

    document = Document()

    # Normal Word document margins.
    for section in document.sections:
        section.top_margin = Pt(45)
        section.bottom_margin = Pt(45)
        section.left_margin = Pt(55)
        section.right_margin = Pt(55)

    first_content = True

    try:

        for page_number, page in enumerate(
            pdf,
            start=1,
        ):

            # Add a page break between source PDF pages.
            if not first_content:
                document.add_page_break()

            first_content = False

            blocks = _extract_page_content(
                page
            )

            # Detect tables on this page.
            table_rects = []

            try:
                tables = page.find_tables()

                for detected_table in tables.tables:
                    table_rects.append(
                        detected_table.bbox
                    )

            except Exception:
                table_rects = []

            # Add content blocks.
            for block in blocks:

                text = _clean_text(
                    block["text"]
                )

                if not text:
                    continue

                # Skip text that is inside a detected table.
                inside_table = False

                for rect in table_rects:

                    if (
                        block["x0"] >= rect[0]
                        and block["x1"] <= rect[2]
                        and block["y0"] >= rect[1]
                        and block["y1"] <= rect[3]
                    ):
                        inside_table = True
                        break

                if inside_table:
                    continue

                if _looks_like_bullet(text):

                    # Remove the original bullet symbol.
                    bullet_text = text[1:].strip()

                    _add_bullet(
                        document,
                        bullet_text,
                    )

                elif _looks_like_heading(text):

                    _add_heading(
                        document,
                        text,
                    )

                else:

                    _add_body_paragraph(
                        document,
                        text,
                    )

            # Add detected tables after text blocks.
            if table_rects:

                try:
                    tables = page.find_tables()

                    for detected_table in tables.tables:

                        data = detected_table.extract()

                        _add_table(
                            document,
                            data,
                        )

                except Exception:
                    pass

    finally:
        pdf.close()

    output = BytesIO()

    document.save(
        output
    )

    return output.getvalue()