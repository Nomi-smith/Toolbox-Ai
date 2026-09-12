from io import BytesIO
import os
import shutil

import fitz
import pytesseract
from PIL import Image


# ============================================================
# TESSERACT DISCOVERY
# ============================================================

def _find_tesseract() -> str | None:
    """
    Find the Tesseract executable.

    Works with:
    - PATH
    - Windows default installation
    - 32-bit Windows installation path
    - TESSERACT_CMD environment variable
    """

    found = shutil.which("tesseract")

    if found:
        return found

    candidates = [
        os.environ.get("TESSERACT_CMD"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]

    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return candidate

    return None


TESSERACT_PATH = _find_tesseract()

if TESSERACT_PATH:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH


# ============================================================
# PAGE DETECTION
# ============================================================

def detect_page_type(page: fitz.Page) -> str:
    """
    Detect whether a PDF page contains a usable text layer.

    Pages with enough extracted text are treated as normal PDFs.
    Pages without meaningful text are treated as scanned pages.
    """

    text = page.get_text("text").strip()

    if len(text) >= 20:
        return "text"

    return "scanned"


# ============================================================
# TESSERACT CHECK
# ============================================================

def _require_tesseract() -> None:
    """
    Make sure Tesseract is available before OCR.
    """

    if not TESSERACT_PATH:
        raise RuntimeError(
            "Tesseract OCR was not found. "
            "Install Tesseract OCR or add tesseract.exe to PATH."
        )


# ============================================================
# RENDER PDF PAGE
# ============================================================

def render_page_to_image(
    page: fitz.Page,
    dpi: int = 200,
) -> Image.Image:
    """
    Render a PDF page to a PIL image.

    The image is only used for OCR.
    """

    zoom = dpi / 72

    matrix = fitz.Matrix(
        zoom,
        zoom,
    )

    pixmap = page.get_pixmap(
        matrix=matrix,
        alpha=False,
    )

    return Image.frombytes(
        "RGB",
        [
            pixmap.width,
            pixmap.height,
        ],
        pixmap.samples,
    )


# ============================================================
# OCR PAGE
# ============================================================

def ocr_page(
    page: fitz.Page,
    dpi: int = 200,
    language: str = "eng",
) -> dict:
    """
    OCR a scanned PDF page.

    Returns:
        text
        words
        page dimensions

    Word coordinates are converted from image pixels
    back into PDF points.
    """

    _require_tesseract()

    image = render_page_to_image(
        page,
        dpi=dpi,
    )

    ocr_data = pytesseract.image_to_data(
        image,
        lang=language,
        config="--psm 3",
        output_type=pytesseract.Output.DICT,
    )

    scale = 72 / dpi

    words = []
    text_parts = []

    total_items = len(
        ocr_data["text"]
    )

    for i in range(total_items):

        text = (
            ocr_data["text"][i]
            .strip()
        )

        if not text:
            continue

        try:
            confidence = float(
                ocr_data["conf"][i]
            )
        except (
            ValueError,
            TypeError,
        ):
            confidence = -1

        if confidence < 0:
            continue

        x = (
            ocr_data["left"][i]
            * scale
        )

        y = (
            ocr_data["top"][i]
            * scale
        )

        width = (
            ocr_data["width"][i]
            * scale
        )

        height = (
            ocr_data["height"][i]
            * scale
        )

        word = {
            "text": text,
            "x": round(x, 2),
            "y": round(y, 2),
            "width": round(width, 2),
            "height": round(height, 2),
            "confidence": round(
                confidence,
                2,
            ),
            "block_num": int(
                ocr_data["block_num"][i]
            ),
            "par_num": int(
                ocr_data["par_num"][i]
            ),
            "line_num": int(
                ocr_data["line_num"][i]
            ),
            "word_num": int(
                ocr_data["word_num"][i]
            ),
        }

        words.append(word)
        text_parts.append(text)

    return {
        "text": " ".join(text_parts),
        "words": words,
        "width": page.rect.width,
        "height": page.rect.height,
    }


# ============================================================
# NORMAL PDF TEXT
# ============================================================

def _normal_page_text(
    page: fitz.Page,
) -> str:
    return page.get_text(
        "text"
    ).strip()


# ============================================================
# NORMAL PDF TEXT BLOCKS
# ============================================================

def _normal_page_lines(
    page: fitz.Page,
) -> list[dict]:
    """
    Extract text lines and their coordinates
    from a normal PDF.

    These coordinates are useful for the PDF editor.
    """

    raw = page.get_text(
        "dict"
    )

    blocks = []

    block_index = 0

    for block in raw.get(
        "blocks",
        [],
    ):

        if block.get(
            "type"
        ) != 0:
            continue

        for line_index, line in enumerate(
            block.get("lines", []),
            start=1,
        ):

            spans = line.get(
                "spans",
                [],
            )

            text = "".join(
                span.get(
                    "text",
                    "",
                )
                for span in spans
            ).strip()

            if not text:
                continue

            bbox = line.get(
                "bbox"
            )

            if (
                not bbox
                or len(bbox) != 4
            ):
                continue

            first_span = (
                spans[0]
                if spans
                else {}
            )

            color_value = int(
                first_span.get(
                    "color",
                    0,
                )
            )

            rgb = [
                (color_value >> 16)
                & 255,
                (color_value >> 8)
                & 255,
                color_value & 255,
            ]

            font_name = str(
                first_span.get(
                    "font",
                    "Helvetica",
                )
            )

            flags = int(
                first_span.get(
                    "flags",
                    0,
                )
            )

            block_index += 1

            blocks.append(
                {
                    "id": (
                        f"p{page.number + 1}"
                        f"-b{block_index}"
                        f"-l{line_index}"
                    ),
                    "text": text,
                    "x": round(
                        float(bbox[0]),
                        2,
                    ),
                    "y": round(
                        float(bbox[1]),
                        2,
                    ),
                    "width": round(
                        float(
                            bbox[2]
                            - bbox[0]
                        ),
                        2,
                    ),
                    "height": round(
                        float(
                            bbox[3]
                            - bbox[1]
                        ),
                        2,
                    ),
                    "font_size": round(
                        float(
                            first_span.get(
                                "size",
                                11,
                            )
                        ),
                        2,
                    ),
                    "font": font_name,
                    "bold": bool(
                        flags & 16
                    ),
                    "italic": bool(
                        flags & 2
                    ),
                    "color": rgb,
                }
            )

    return blocks


# ============================================================
# OCR LINE BLOCKS
# ============================================================

def _ocr_line_blocks(
    ocr_words: list[dict],
    page_number: int,
) -> list[dict]:
    """
    Group OCR words into line-level blocks.

    These are used for editor metadata and debugging.
    """

    groups: dict[
        tuple[int, int, int],
        list[dict],
    ] = {}

    for word in ocr_words:

        key = (
            word.get(
                "block_num",
                0,
            ),
            word.get(
                "par_num",
                0,
            ),
            word.get(
                "line_num",
                0,
            ),
        )

        groups.setdefault(
            key,
            [],
        ).append(word)

    blocks = []

    for index, words in enumerate(
        groups.values(),
        start=1,
    ):

        words = sorted(
            words,
            key=lambda item: item.get(
                "word_num",
                0,
            ),
        )

        if not words:
            continue

        text = " ".join(
            word["text"]
            for word in words
        ).strip()

        if not text:
            continue

        x1 = min(
            word["x"]
            for word in words
        )

        y1 = min(
            word["y"]
            for word in words
        )

        x2 = max(
            word["x"]
            + word["width"]
            for word in words
        )

        y2 = max(
            word["y"]
            + word["height"]
            for word in words
        )

        font_size = max(
            6,
            (
                sum(
                    word["height"]
                    for word in words
                )
                / len(words)
                * 0.8
            ),
        )

        confidence = (
            sum(
                word.get(
                    "confidence",
                    0,
                )
                for word in words
            )
            / len(words)
        )

        blocks.append(
            {
                "id": (
                    f"p{page_number}"
                    f"-ocr-{index}"
                ),
                "text": text,
                "x": round(
                    x1,
                    2,
                ),
                "y": round(
                    y1,
                    2,
                ),
                "width": round(
                    x2 - x1,
                    2,
                ),
                "height": round(
                    y2 - y1,
                    2,
                ),
                "font_size": round(
                    font_size,
                    2,
                ),
                "font": "Helvetica",
                "bold": False,
                "italic": False,
                "color": [
                    0,
                    0,
                    0,
                ],
                "confidence": round(
                    confidence,
                    2,
                ),
            }
        )

    return blocks


# ============================================================
# ANALYZE PDF
# ============================================================

def analyze_pdf(
    pdf_bytes: bytes,
    language: str = "eng",
) -> dict:
    """
    Analyze every PDF page.

    Normal PDF pages:
        Existing text layer is used.

    Scanned pages:
        Tesseract OCR is used.
    """

    document = fitz.open(
        stream=pdf_bytes,
        filetype="pdf",
    )

    pages = []

    try:

        for page_number, page in enumerate(
            document,
            start=1,
        ):

            page_type = detect_page_type(
                page
            )

            if page_type == "text":

                text = _normal_page_text(
                    page
                )

                pages.append(
                    {
                        "page": page_number,
                        "type": "text",
                        "text": text,
                        "words": [],
                        "blocks": (
                            _normal_page_lines(
                                page
                            )
                        ),
                        "width": page.rect.width,
                        "height": page.rect.height,
                    }
                )

            else:

                ocr_result = ocr_page(
                    page,
                    language=language,
                )

                pages.append(
                    {
                        "page": page_number,
                        "type": "scanned",
                        "text": (
                            ocr_result[
                                "text"
                            ]
                        ),
                        "words": (
                            ocr_result[
                                "words"
                            ]
                        ),
                        "blocks": (
                            _ocr_line_blocks(
                                ocr_result[
                                    "words"
                                ],
                                page_number,
                            )
                        ),
                        "width": (
                            ocr_result[
                                "width"
                            ]
                        ),
                        "height": (
                            ocr_result[
                                "height"
                            ]
                        ),
                    }
                )

    finally:
        document.close()

    return {
        "pages": pages,
        "total_pages": len(
            pages
        ),
        "scanned_pages": sum(
            page["type"] == "scanned"
            for page in pages
        ),
        "text_pages": sum(
            page["type"] == "text"
            for page in pages
        ),
    }


# ============================================================
# MAKE SCANNED PDF SEARCHABLE
# ============================================================

def make_searchable_pdf(
    pdf_bytes: bytes,
    language: str = "eng",
) -> bytes:
    """
    Add an invisible OCR text layer to scanned pages.

    The original scanned image remains visually unchanged.
    """

    document = fitz.open(
        stream=pdf_bytes,
        filetype="pdf",
    )

    try:

        for page in document:

            if (
                detect_page_type(page)
                != "scanned"
            ):
                continue

            ocr_result = ocr_page(
                page,
                language=language,
            )

            writer = fitz.TextWriter(
                page.rect
            )

            for word in ocr_result[
                "words"
            ]:

                writer.append(
                    fitz.Point(
                        word["x"],
                        word["y"]
                        + word["height"],
                    ),
                    word["text"],
                    fontsize=max(
                        4,
                        word["height"]
                        * 0.8,
                    ),
                )

            writer.write_text(
                page,
                color=(
                    0,
                    0,
                    0,
                ),
                render_mode=3,
            )

        output = BytesIO()

        document.save(
            output,
            garbage=4,
            deflate=True,
        )

        return output.getvalue()

    finally:
        document.close()


# ============================================================
# FONT MAPPING
# ============================================================

def _font_alias(
    font_name: str,
) -> str:
    """
    Map common PDF fonts to PyMuPDF built-in fonts.
    """

    name = font_name.lower()

    mapping = {
        "helvetica-boldoblique": "hebi",
        "helvetica-bold": "hebo",
        "helvetica-oblique": "heit",
        "helvetica": "helv",

        "arial-bold": "hebo",
        "arial": "helv",

        "times-bolditalic": "tibi",
        "times-bold": "tibo",
        "times-italic": "tiit",
        "times-roman": "tiro",
        "times": "tiro",

        "courier-bold": "courb",
        "courier-oblique": "couri",
        "courier": "cour",
    }

    for key, alias in mapping.items():

        if key in name:
            return alias

    return "helv"


# ============================================================
# FITTED TEXT INSERTION
# ============================================================

def _insert_fitted_text(
    page: fitz.Page,
    rect: fitz.Rect,
    text: str,
    fontsize: float,
    fontname: str,
    color: tuple[float, float, float],
) -> None:
    """
    Insert replacement text inside the selected rectangle.

    If the new text is too large, gradually reduce the
    font size until it fits.
    """

    size = max(
        5.0,
        float(fontsize),
    )

    for _ in range(12):

        result = page.insert_textbox(
            rect,
            text,
            fontsize=size,
            fontname=fontname,
            color=color,
            align=fitz.TEXT_ALIGN_LEFT,
        )

        if result >= 0:
            return

        size *= 0.9

    # Last-resort insertion.
    page.insert_text(
        rect.tl,
        text,
        fontsize=max(
            5,
            size,
        ),
        fontname=fontname,
        color=color,
    )


# ============================================================
# PDF EDITOR
# ============================================================

def edit_pdf(
    pdf_bytes: bytes,
    edits: list[dict],
) -> bytes:
    """
    Apply user-selected PDF text edits.

    Each edit can contain:

        page
        old_text
        new_text
        x
        y
        width
        height

    Coordinates are PDF points.

    IMPORTANT:
    The selected rectangle is used whenever available.

    This means if the same word appears 10 times,
    editing one selected occurrence changes only that
    occurrence.
    """

    document = fitz.open(
        stream=pdf_bytes,
        filetype="pdf",
    )

    try:

        for edit in edits:

            try:
                page_number = int(
                    edit.get(
                        "page",
                        0,
                    )
                )
            except (
                ValueError,
                TypeError,
            ):
                continue

            if (
                page_number < 1
                or page_number > len(
                    document
                )
            ):
                raise ValueError(
                    f"Invalid PDF page: {page_number}"
                )

            old_text = str(
                edit.get(
                    "old_text",
                    "",
                )
            ).strip()

            new_text = str(
                edit.get(
                    "new_text",
                    "",
                )
            )

            if not old_text:
                continue

            if not new_text.strip():
                raise ValueError(
                    "Replacement text cannot be empty."
                )

            page = document[
                page_number - 1
            ]

            # ------------------------------------------------
            # DETERMINE TARGET RECTANGLE
            # ------------------------------------------------

            rect = None

            try:

                x = float(
                    edit.get(
                        "x",
                        0,
                    )
                )

                y = float(
                    edit.get(
                        "y",
                        0,
                    )
                )

                width = float(
                    edit.get(
                        "width",
                        0,
                    )
                )

                height = float(
                    edit.get(
                        "height",
                        0,
                    )
                )

                if (
                    width > 0
                    and height > 0
                ):
                    rect = fitz.Rect(
                        x,
                        y,
                        x + width,
                        y + height,
                    )

            except (
                ValueError,
                TypeError,
            ):
                rect = None

            # ------------------------------------------------
            # FALLBACK SEARCH
            # ------------------------------------------------

            if rect is None:

                matches = page.search_for(
                    old_text
                )

                if not matches:
                    raise ValueError(
                        f'Could not find "{old_text[:100]}" '
                        f"on page {page_number}."
                    )

                rect = matches[0]

            # Keep rectangle inside page.
            rect &= page.rect

            if rect.is_empty:
                raise ValueError(
                    "The selected text rectangle is invalid."
                )

            # ------------------------------------------------
            # DETECT ORIGINAL STYLE
            # ------------------------------------------------

            fontsize = max(
                6.0,
                rect.height * 0.8,
            )

            fontname = "helv"

            color = (
                0.0,
                0.0,
                0.0,
            )

            text_info = page.get_text(
                "dict",
                clip=rect,
            )

            found_style = False

            for block in text_info.get(
                "blocks",
                [],
            ):

                if block.get(
                    "type"
                ) != 0:
                    continue

                for line in block.get(
                    "lines",
                    [],
                ):

                    for span in line.get(
                        "spans",
                        [],
                    ):

                        fontsize = float(
                            span.get(
                                "size",
                                fontsize,
                            )
                        )

                        fontname = _font_alias(
                            str(
                                span.get(
                                    "font",
                                    "Helvetica",
                                )
                            )
                        )

                        color_value = int(
                            span.get(
                                "color",
                                0,
                            )
                        )

                        color = (
                            (
                                (
                                    color_value
                                    >> 16
                                )
                                & 255
                            )
                            / 255,
                            (
                                (
                                    color_value
                                    >> 8
                                )
                                & 255
                            )
                            / 255,
                            (
                                color_value
                                & 255
                            )
                            / 255,
                        )

                        found_style = True
                        break

                    if found_style:
                        break

                if found_style:
                    break

            # ------------------------------------------------
            # REDACT OLD TEXT
            # ------------------------------------------------

            page.add_redact_annot(
                rect,
                fill=(
                    1,
                    1,
                    1,
                ),
            )

            page.apply_redactions()

            # ------------------------------------------------
            # INSERT NEW TEXT
            # ------------------------------------------------

            _insert_fitted_text(
                page=page,
                rect=rect,
                text=new_text,
                fontsize=fontsize,
                fontname=fontname,
                color=color,
            )

        # ----------------------------------------------------
        # SAVE
        # ----------------------------------------------------

        output = BytesIO()

        document.save(
            output,
            garbage=4,
            deflate=True,
        )

        return output.getvalue()

    finally:
        document.close()