import io
import sys
from pathlib import Path

import streamlit as st

# Allow imports from the existing backend folder
BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from image_tools import remove_background
from pdf_tools import pdf_to_word
from pdf_extract import extract_pdf_text
from pdf_ocr import make_searchable_pdf


# ---------------------------------------------------------
# Page configuration
# ---------------------------------------------------------

st.set_page_config(
    page_title="Personal Toolbox AI",
    page_icon="🧰",
    layout="wide",
)


# ---------------------------------------------------------
# Styling
# ---------------------------------------------------------

st.markdown(
    """
    <style>
        .main {
            background-color: #f7f7f5;
        }

        .block-container {
            max-width: 1200px;
            padding-top: 2rem;
            padding-bottom: 3rem;
        }

        .hero {
            padding: 2rem 0 1rem 0;
        }

        .hero h1 {
            font-size: 3rem;
            font-weight: 800;
            letter-spacing: -0.04em;
            margin-bottom: 0.4rem;
        }

        .hero p {
            font-size: 1.1rem;
            color: #666;
            max-width: 700px;
        }

        .tool-card {
            padding: 1.2rem;
            border: 1px solid #e5e5e5;
            border-radius: 18px;
            background: white;
            min-height: 150px;
        }

        .tool-card h3 {
            margin-bottom: 0.4rem;
        }

        .tool-card p {
            color: #666;
            font-size: 0.95rem;
        }

        footer {
            visibility: hidden;
        }
    </style>
    """,
    unsafe_allow_html=True,
)


# ---------------------------------------------------------
# Helper functions
# ---------------------------------------------------------

def get_bytes(uploaded_file):
    if uploaded_file is None:
        return None
    return uploaded_file.getvalue()


def safe_filename(name: str, extension: str) -> str:
    stem = Path(name).stem
    return f"{stem}{extension}"


# ---------------------------------------------------------
# Header
# ---------------------------------------------------------

st.markdown(
    """
    <div class="hero">
        <h1>Personal Toolbox AI</h1>
        <p>
            One smart workspace for everyday PDF, image, document,
            and AI-powered productivity tasks.
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)


# ---------------------------------------------------------
# Sidebar navigation
# ---------------------------------------------------------

st.sidebar.title("Toolbox")

tool = st.sidebar.radio(
    "Choose a tool",
    [
        "Home",
        "Background Removal",
        "PDF → Word",
        "PDF Text Extraction",
        "Make PDF Searchable",
    ],
)


# =========================================================
# HOME
# =========================================================

if tool == "Home":

    st.subheader("What do you want to do?")

    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown(
            """
            <div class="tool-card">
                <h3>🖼️ Background Removal</h3>
                <p>
                    Automatically remove the background from an image
                    using AI.
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col2:
        st.markdown(
            """
            <div class="tool-card">
                <h3>📄 PDF → Word</h3>
                <p>
                    Convert PDF documents into editable Word files.
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col3:
        st.markdown(
            """
            <div class="tool-card">
                <h3>🔎 PDF Text</h3>
                <p>
                    Extract readable text from PDF documents.
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.write("")

    col4, col5, col6 = st.columns(3)

    with col4:
        st.markdown(
            """
            <div class="tool-card">
                <h3>🧾 Searchable PDF</h3>
                <p>
                    Use OCR to turn scanned PDFs into searchable documents.
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col5:
        st.markdown(
            """
            <div class="tool-card">
                <h3>🤖 AI Tools</h3>
                <p>
                    AI-powered document understanding and automation.
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col6:
        st.markdown(
            """
            <div class="tool-card">
                <h3>🚀 More Coming</h3>
                <p>
                    CV analysis, image enhancement, workflows, and more.
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.info(
        "Select a tool from the sidebar to test the current Toolbox AI modules."
    )


# =========================================================
# BACKGROUND REMOVAL
# =========================================================

elif tool == "Background Removal":

    st.header("Background Removal")

    uploaded = st.file_uploader(
        "Upload an image",
        type=["png", "jpg", "jpeg", "webp"],
    )

    if uploaded:

        st.image(
            uploaded,
            caption="Original image",
            use_container_width=True,
        )

        if st.button(
            "Remove Background",
            type="primary",
            use_container_width=True,
        ):

            try:
                with st.spinner("Removing background..."):

                    input_bytes = get_bytes(uploaded)

                    result = remove_background(input_bytes)

                st.success("Background removed successfully.")

                st.image(
                    result,
                    caption="Result",
                    use_container_width=True,
                )

                st.download_button(
                    "Download PNG",
                    data=result,
                    file_name=safe_filename(
                        uploaded.name,
                        ".png",
                    ),
                    mime="image/png",
                    use_container_width=True,
                )

            except Exception as exc:
                st.error(f"Background removal failed: {exc}")


# =========================================================
# PDF → WORD
# =========================================================

elif tool == "PDF → Word":

    st.header("PDF → Word")

    uploaded = st.file_uploader(
        "Upload a PDF",
        type=["pdf"],
    )

    if uploaded:

        st.info(
            "Convert your PDF into an editable Microsoft Word document."
        )

        if st.button(
            "Convert to Word",
            type="primary",
            use_container_width=True,
        ):

            try:

                with st.spinner("Converting PDF to Word..."):

                    pdf_bytes = get_bytes(uploaded)

                    result = pdf_to_word(pdf_bytes)

                st.success("Conversion completed.")

                st.download_button(
                    "Download Word Document",
                    data=result,
                    file_name=safe_filename(
                        uploaded.name,
                        ".docx",
                    ),
                    mime=(
                        "application/vnd.openxmlformats-officedocument."
                        "wordprocessingml.document"
                    ),
                    use_container_width=True,
                )

            except Exception as exc:
                st.error(f"PDF to Word failed: {exc}")


# =========================================================
# PDF TEXT EXTRACTION
# =========================================================

elif tool == "PDF Text Extraction":

    st.header("PDF Text Extraction")

    uploaded = st.file_uploader(
        "Upload a PDF",
        type=["pdf"],
    )

    if uploaded:

        if st.button(
            "Extract Text",
            type="primary",
            use_container_width=True,
        ):

            try:

                with st.spinner("Extracting text..."):

                    pdf_bytes = get_bytes(uploaded)

                    result = extract_pdf_text(pdf_bytes)

                st.success("Text extracted successfully.")

                if isinstance(result, dict):
                    pages = result.get("pages", [])
                else:
                    pages = result

                if isinstance(pages, list):

                    text_parts = []

                    for index, page in enumerate(pages):

                        if isinstance(page, dict):
                            page_text = page.get("text", "")
                        else:
                            page_text = str(page)

                        text_parts.append(
                            f"--- Page {index + 1} ---\n\n"
                            f"{page_text}"
                        )

                    final_text = "\n\n".join(text_parts)

                else:
                    final_text = str(pages)

                st.text_area(
                    "Extracted text",
                    final_text,
                    height=450,
                )

                st.download_button(
                    "Download TXT",
                    data=final_text,
                    file_name=safe_filename(
                        uploaded.name,
                        ".txt",
                    ),
                    mime="text/plain",
                    use_container_width=True,
                )

            except Exception as exc:
                st.error(f"Text extraction failed: {exc}")


# =========================================================
# SEARCHABLE PDF / OCR
# =========================================================

elif tool == "Make PDF Searchable":

    st.header("Make PDF Searchable")

    uploaded = st.file_uploader(
        "Upload a scanned PDF",
        type=["pdf"],
    )

    if uploaded:

        st.info(
            "OCR the scanned PDF and create a searchable PDF."
        )

        if st.button(
            "Make Searchable",
            type="primary",
            use_container_width=True,
        ):

            try:

                with st.spinner(
                    "Running OCR and creating searchable PDF..."
                ):

                    pdf_bytes = get_bytes(uploaded)

                    result = make_searchable_pdf(pdf_bytes)

                st.success(
                    "Searchable PDF created successfully."
                )

                st.download_button(
                    "Download Searchable PDF",
                    data=result,
                    file_name=safe_filename(
                        uploaded.name,
                        "-searchable.pdf",
                    ),
                    mime="application/pdf",
                    use_container_width=True,
                )

            except Exception as exc:
                st.error(
                    f"Creating searchable PDF failed: {exc}"
                )


# ---------------------------------------------------------
# Footer
# ---------------------------------------------------------

st.divider()

st.caption(
    "Personal Toolbox AI • AI-powered productivity workspace"
)