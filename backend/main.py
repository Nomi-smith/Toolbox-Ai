import json
import uuid
import os

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    HTTPException,
    Form,
)

from fastapi.middleware.cors import (
    CORSMiddleware,
)

from fastapi.responses import Response


from image_tools import remove_background

from pdf_tools import pdf_to_word

from pdf_extract import extract_pdf_text

from pdf_ocr import (
    analyze_pdf,
    make_searchable_pdf,
    edit_pdf,
)

from rag_engine import answer_question

from auto_router import route_request

from workflow_engine import execute_workflow


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="Toolbox AI",
    description=(
        "AI-powered productivity toolbox "
        "with controlled AI routing."
    ),
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

frontend_url = os.getenv("FRONTEND_URL", "").strip()

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Toolbox-Tool",
        "X-Toolbox-Reason",
    ],
)


# ============================================================
# TEMPORARY WORKFLOW STORAGE
# ============================================================

workflow_files: dict[
    str,
    bytes,
] = {}


# ============================================================
# BASIC ROUTES
# ============================================================

@app.get("/")
def root():
    return {
        "message": (
            "Toolbox AI backend is running."
        )
    }


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


# ============================================================
# AI AUTO MODE — ROUTING ONLY
# ============================================================

@app.post("/auto/route")
async def auto_route(
    request: str = Form(...),
    filename: str | None = Form(None),
):
    try:

        result = route_request(
            request=request,
            filename=filename,
        )

        return {
            "request": request,
            "filename": filename,
            "tool": result["tool"],
            "reason": result["reason"],
            "confidence": result[
                "confidence"
            ],
        }

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# AI AUTO MODE — ROUTE + EXECUTE
# ============================================================

@app.post("/auto")
async def auto_execute(
    request: str = Form(...),
    file: UploadFile | None = File(None),
):
    filename = (
        file.filename
        if file
        else None
    )

    try:

        route = route_request(
            request=request,
            filename=filename,
        )

        tool = route["tool"]

        reason = route["reason"]

        file_bytes = None

        if file:
            file_bytes = await file.read()

        file_required_tools = {
            "remove_background",
            "pdf_to_word",
            "pdf_extract_text",
            "pdf_ask",
        }

        if (
            tool in file_required_tools
            and not file_bytes
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "This task requires "
                    "an uploaded file."
                ),
            )

        # ====================================================
        # BACKGROUND REMOVAL
        # ====================================================

        if tool == "remove_background":

            if not file:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please upload "
                        "an image."
                    ),
                )

            content_type = (
                file.content_type
                or ""
            )

            if content_type not in {
                "image/png",
                "image/jpeg",
                "image/jpg",
            }:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please upload "
                        "a PNG or JPG image."
                    ),
                )

            output = remove_background(
                file_bytes
            )

            return Response(
                content=output,
                media_type="image/png",
                headers={
                    "Content-Disposition": (
                        'attachment; '
                        'filename="toolbox-background-removed.png"'
                    ),
                    "X-Toolbox-Tool": tool,
                    "X-Toolbox-Reason": reason,
                },
            )

        # ====================================================
        # PDF → WORD
        # ====================================================

        if tool == "pdf_to_word":

            if not file:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please upload "
                        "a PDF file."
                    ),
                )

            if (
                file.content_type
                != "application/pdf"
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please upload "
                        "a PDF file."
                    ),
                )

            output = pdf_to_word(
                file_bytes
            )

            return Response(
                content=output,
                media_type=(
                    "application/"
                    "vnd.openxmlformats-officedocument."
                    "wordprocessingml.document"
                ),
                headers={
                    "Content-Disposition": (
                        'attachment; '
                        'filename="toolbox-converted.docx"'
                    ),
                    "X-Toolbox-Tool": tool,
                    "X-Toolbox-Reason": reason,
                },
            )

        # ====================================================
        # PDF TEXT EXTRACTION
        # ====================================================

        if tool == "pdf_extract_text":

            if not file:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please upload "
                        "a PDF file."
                    ),
                )

            if (
                file.content_type
                != "application/pdf"
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please upload "
                        "a PDF file."
                    ),
                )

            pages = extract_pdf_text(
                file_bytes
            )

            return {
                "tool": tool,
                "reason": reason,
                "pages": pages,
            }

        # ====================================================
        # PDF AI Q&A
        # ====================================================

        if tool == "pdf_ask":

            if not file:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please upload "
                        "a PDF file."
                    ),
                )

            if (
                file.content_type
                != "application/pdf"
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please upload "
                        "a PDF file."
                    ),
                )

            pages = extract_pdf_text(
                file_bytes
            )

            result = answer_question(
                question=request,
                pages=pages,
            )

            return {
                "tool": tool,
                "reason": reason,
                "answer": result[
                    "answer"
                ],
                "sources": result[
                    "sources"
                ],
            }

        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported tool: {tool}"
            ),
        )

    except HTTPException:
        raise

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# MULTI-STEP WORKFLOW
# ============================================================

@app.post("/auto/workflow")
async def auto_workflow(
    request: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Plan and execute a controlled
    multi-step AI workflow.
    """

    if not request.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "Please describe the "
                "workflow you want to perform."
            ),
        )

    if (
        file.content_type
        != "application/pdf"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Workflow currently "
                "supports PDF files."
            ),
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail=(
                "The uploaded file "
                "is empty."
            ),
        )

    try:

        result = execute_workflow(
            request=request,
            file_bytes=file_bytes,
            filename=file.filename,
        )

        word_file = result.get(
            "word_file"
        )

        download_id = None

        if word_file:

            download_id = str(
                uuid.uuid4()
            )

            workflow_files[
                download_id
            ] = word_file

        return {
            "workflow": result[
                "workflow"
            ],
            "steps": result[
                "steps"
            ],
            "summary": result[
                "summary"
            ],
            "answer": result[
                "answer"
            ],
            "sources": result[
                "sources"
            ],
            "extracted_text": result[
                "extracted_text"
            ],
            "has_word_file": (
                word_file is not None
            ),
            "download_id": download_id,
        }

    except HTTPException:
        raise

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# WORKFLOW WORD DOWNLOAD
# ============================================================

@app.get(
    "/auto/workflow/download/{download_id}"
)
async def download_workflow_word(
    download_id: str,
):

    word_file = workflow_files.get(
        download_id
    )

    if word_file is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Workflow Word file "
                "not found or expired."
            ),
        )

    return Response(
        content=word_file,
        media_type=(
            "application/"
            "vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
        headers={
            "Content-Disposition": (
                'attachment; '
                'filename="toolbox-workflow-result.docx"'
            )
        },
    )


# ============================================================
# IMAGE — REMOVE BACKGROUND
# ============================================================

@app.post(
    "/image/remove-background"
)
async def remove_background_endpoint(
    file: UploadFile = File(...),
):

    if (
        not file.content_type
        or not file.content_type.startswith(
            "image/"
        )
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload "
                "an image file."
            ),
        )

    file_bytes = await file.read()

    try:

        output = remove_background(
            file_bytes
        )

        return Response(
            content=output,
            media_type="image/png",
            headers={
                "Content-Disposition": (
                    'attachment; '
                    'filename="background-removed.png"'
                )
            },
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# PDF → WORD
# ============================================================

@app.post("/pdf/to-word")
async def pdf_to_word_endpoint(
    file: UploadFile = File(...),
):

    if (
        file.content_type
        != "application/pdf"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload "
                "a PDF file."
            ),
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail=(
                "The uploaded PDF "
                "is empty."
            ),
        )

    try:

        output = pdf_to_word(
            file_bytes
        )

        return Response(
            content=output,
            media_type=(
                "application/"
                "vnd.openxmlformats-officedocument."
                "wordprocessingml.document"
            ),
            headers={
                "Content-Disposition": (
                    'attachment; '
                    'filename="converted.docx"'
                )
            },
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# PDF TEXT EXTRACTION
# ============================================================

@app.post("/pdf/extract-text")
async def pdf_extract_text_endpoint(
    file: UploadFile = File(...),
):

    if (
        file.content_type
        != "application/pdf"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload "
                "a PDF file."
            ),
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail=(
                "The uploaded PDF "
                "is empty."
            ),
        )

    try:

        pages = extract_pdf_text(
            file_bytes
        )

        return {
            "pages": pages
        }

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# PDF AI Q&A
# ============================================================

@app.post("/pdf/ask")
async def pdf_ask_endpoint(
    file: UploadFile = File(...),
    question: str = Form(...),
):

    if (
        file.content_type
        != "application/pdf"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload "
                "a PDF file."
            ),
        )

    if not question.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "Please enter "
                "a question."
            ),
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail=(
                "The uploaded PDF "
                "is empty."
            ),
        )

    try:

        pages = extract_pdf_text(
            file_bytes
        )

        result = answer_question(
            question=question,
            pages=pages,
        )

        return result

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# PDF ANALYSIS / OCR
# ============================================================

@app.post("/pdf/analyze")
async def pdf_analyze_endpoint(
    file: UploadFile = File(...),
):

    if (
        file.content_type
        != "application/pdf"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload "
                "a PDF file."
            ),
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail=(
                "The uploaded PDF "
                "is empty."
            ),
        )

    try:

        result = analyze_pdf(
            file_bytes
        )

        return result

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# PDF EDITOR DATA
# ============================================================

@app.post("/pdf/editor-data")
async def pdf_editor_data_endpoint(
    file: UploadFile = File(...),
):

    if (
        file.content_type
        != "application/pdf"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload "
                "a PDF file."
            ),
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail=(
                "The uploaded PDF "
                "is empty."
            ),
        )

    try:

        result = analyze_pdf(
            file_bytes
        )

        return result

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# MAKE PDF SEARCHABLE
# ============================================================

@app.post(
    "/pdf/make-searchable"
)
async def make_searchable_pdf_endpoint(
    file: UploadFile = File(...),
):

    if (
        file.content_type
        != "application/pdf"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload "
                "a PDF file."
            ),
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail=(
                "The uploaded PDF "
                "is empty."
            ),
        )

    try:

        output = make_searchable_pdf(
            file_bytes
        )

        return Response(
            content=output,
            media_type="application/pdf",
            headers={
                "Content-Disposition": (
                    'attachment; '
                    'filename="toolbox-searchable.pdf"'
                )
            },
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# PDF EDIT
# ============================================================

@app.post("/pdf/edit")
async def pdf_edit_endpoint(
    file: UploadFile = File(...),
    edits: str = Form(...),
):

    if (
        file.content_type
        != "application/pdf"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload "
                "a PDF file."
            ),
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail=(
                "The uploaded PDF "
                "is empty."
            ),
        )

    # --------------------------------------------------------
    # Parse edits
    # --------------------------------------------------------

    try:

        parsed_edits = json.loads(
            edits
        )

    except json.JSONDecodeError:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid edit data. "
                "The edits field must "
                "contain valid JSON."
            ),
        )

    if not isinstance(
        parsed_edits,
        list,
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "The edits field "
                "must be a JSON list."
            ),
        )

    if not parsed_edits:
        raise HTTPException(
            status_code=400,
            detail=(
                "No PDF edits were supplied."
            ),
        )

    try:

        output = edit_pdf(
            pdf_bytes=file_bytes,
            edits=parsed_edits,
        )

        return Response(
            content=output,
            media_type="application/pdf",
            headers={
                "Content-Disposition": (
                    'attachment; '
                    'filename="toolbox-edited.pdf"'
                )
            },
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )