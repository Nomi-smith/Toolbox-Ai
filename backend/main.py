import json
import uuid
import os
import io
import re
import zipfile
import urllib.parse
import urllib.request
from html.parser import HTMLParser

import fitz

from dotenv import load_dotenv

load_dotenv()

JSEARCH_API_KEY = os.getenv("JSEARCH_API_KEY")

from fastapi import FastAPI

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
from image_analyze import analyze_image

from pdf_tools import pdf_to_word

from pdf_extract import extract_pdf_text
from pdf_data_extractor import extract_structured_data

from pdf_ocr import (
    analyze_pdf,
    make_searchable_pdf,
    edit_pdf,
)

from rag_engine import answer_question

from auto_router import route_request

from workflow_engine import execute_workflow
from cv_career import extract_cv_text, analyze_cv, recalculate_ats
from cv_tools import build_profile_from_text, create_cv_docx


# ============================================================
# IMAGE → PDF HELPER
# ============================================================

def image_to_pdf(image_bytes: bytes) -> bytes:
    """Convert one Pillow-readable image into a PDF."""
    return images_to_pdf([image_bytes])


def images_to_pdf(image_bytes_list: list[bytes]) -> bytes:
    """Convert one or more Pillow-readable images into a single multi-page PDF."""
    from PIL import Image

    if not image_bytes_list:
        raise ValueError("Please provide at least one image.")

    try:
        images = [
            decode_image_bytes(data).convert("RGB")
            for data in image_bytes_list
        ]

        output = io.BytesIO()
        images[0].save(
            output,
            format="PDF",
            resolution=100.0,
            save_all=True,
            append_images=images[1:],
        )
        return output.getvalue()
    except Exception as exc:
        raise ValueError(f"Could not convert the image(s) to PDF: {exc}") from exc


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="MyToolbox AI",
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
# CV & CAREER WORKSPACE
# ============================================================

@app.post("/cv/analyze")
async def cv_analyze(
    file: UploadFile = File(...),
    target_job: str = Form(""),
):
    """Extract a CV and return structured AI career intelligence."""
    filename = (file.filename or "").strip()
    lower = filename.lower()

    if not (lower.endswith(".pdf") or lower.endswith(".docx")):
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF or DOCX CV.",
        )

    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(
                status_code=400,
                detail="The uploaded CV is empty.",
            )

        cv_text = extract_cv_text(file_bytes, filename)
        result = analyze_cv(cv_text, target_job)

        return {
            "filename": filename,
            "text_chars": len(cv_text),
            "analysis": result,
        }

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"CV analysis failed: {exc}",
        ) from exc


# ============================================================
# CV & CAREER — PROFILE BUILDER
# ============================================================

class _LinkedInTextParser(HTMLParser):
    """Small, dependency-free parser for publicly visible LinkedIn HTML text."""
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag.lower() in {"script", "style", "noscript", "svg"}:
            self._skip_depth += 1

    def handle_endtag(self, tag):
        if tag.lower() in {"script", "style", "noscript", "svg"} and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data):
        if not self._skip_depth:
            value = " ".join(data.split())
            if value:
                self.parts.append(value)


def fetch_linkedin_profile_text(profile_url: str) -> str:
    """Fetch a public LinkedIn profile page and extract visible text.

    LinkedIn may require authentication or return a limited page. We therefore
    fail clearly instead of pretending we successfully scraped a profile.
    """
    try:
        parsed = urllib.parse.urlparse(profile_url)
    except Exception as exc:
        raise ValueError("Enter a valid LinkedIn profile URL.") from exc

    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme != "https" or host not in {"linkedin.com", "www.linkedin.com"} or not parsed.path.startswith("/in/"):
        raise ValueError("Please enter a public LinkedIn profile URL such as https://www.linkedin.com/in/your-name/.")

    request = urllib.request.Request(
        profile_url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            content_type = (response.headers.get("Content-Type") or "").lower()
            if "text/html" not in content_type:
                raise ValueError("LinkedIn did not return a readable public profile page.")
            html = response.read(2_500_000).decode("utf-8", errors="replace")
    except Exception as exc:
        raise ValueError("LinkedIn could not be read. Make sure the profile is public and the URL is correct.") from exc

    parser = _LinkedInTextParser()
    parser.feed(html)
    text = "\n".join(parser.parts)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    blocked_markers = ["sign in", "join now", "authwall", "checkpoint"]
    if len(text) < 80 or sum(marker in text.lower() for marker in blocked_markers) >= 2:
        raise ValueError("LinkedIn returned a restricted page. The profile must be publicly viewable without signing in.")

    return text[:50000]


@app.post("/cv/profile")
async def cv_profile(
    file: UploadFile | None = File(None),
    source_type: str = Form("cv"),
    profile_text: str = Form(""),
    linkedin_url: str = Form(""),
):
    """Build an editable professional profile from a CV or public LinkedIn URL."""
    source_type = source_type.strip().lower()
    if source_type not in {"cv", "linkedin"}:
        raise HTTPException(status_code=400, detail="Unsupported profile source.")

    try:
        if source_type == "linkedin":
            url = linkedin_url.strip()
            if not url:
                raise HTTPException(status_code=400, detail="Enter your LinkedIn profile URL.")
            text = fetch_linkedin_profile_text(url)
            text = f"LinkedIn profile URL: {url}\n\n{text}"
        else:
            if not file:
                raise HTTPException(status_code=400, detail="Please upload a PDF or DOCX CV.")
            filename = (file.filename or "").strip()
            if not (filename.lower().endswith(".pdf") or filename.lower().endswith(".docx")):
                raise HTTPException(status_code=400, detail="Please upload a PDF or DOCX CV.")
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail="The uploaded CV is empty.")
            text = extract_cv_text(data, filename)

        profile = build_profile_from_text(text, source_type)
        if source_type == "linkedin" and not profile.get("linkedin"):
            profile["linkedin"] = linkedin_url.strip()
        return {"source_type": source_type, "profile": profile}
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Profile building failed: {exc}") from exc


@app.post("/cv/build")
async def cv_build(profile_json: str = Form(...), template: str = Form("ats-classic")):
    """Generate a Word CV from the user-approved editable profile and selected template."""
    try:
        profile = json.loads(profile_json)
        if not isinstance(profile, dict):
            raise ValueError("Invalid profile data.")
        profile["template"] = template.strip().lower()
        output = create_cv_docx(profile)
        return Response(
            content=output,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": 'attachment; filename="mytoolbox-cv.docx"'},
        )
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid profile JSON.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"CV export failed: {exc}") from exc


# ============================================================
# CV & CAREER — ATS RECALCULATION
# ============================================================

@app.post("/cv/recalculate-ats")
async def cv_recalculate_ats(
    target_job: str = Form(...),
    analysis_json: str = Form(...),
    applied_actions_json: str = Form("[]"),
):
    try:
        analysis = json.loads(analysis_json)
        applied_actions = json.loads(applied_actions_json)
        if not isinstance(analysis, dict) or not isinstance(applied_actions, list):
            raise ValueError("Invalid ATS recalculation payload.")
        return recalculate_ats(target_job, analysis, applied_actions)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid ATS recalculation data.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ATS recalculation failed: {exc}") from exc


# ============================================================
# CV & CAREER — LIVE JOB MATCHING
# ============================================================

@app.post("/cv/jobs")
async def cv_jobs(
    target_role: str = Form(...),
    location: str = Form(""),
    skills_json: str = Form("[]"),
):
    """Fetch live jobs from JSearch through RapidAPI."""
    role = target_role.strip()

    if not role:
        raise HTTPException(
            status_code=400,
            detail="Please provide a target role."
        )

    api_key = os.getenv("JSEARCH_API_KEY", "").strip()

    if not api_key:
        return {
            "configured": False,
            "jobs": [],
            "message": "Live job search needs JSEARCH_API_KEY in the backend environment.",
        }

    try:
        # Build a better search query.
        query_parts = [role]

        if location.strip():
            query_parts.append(f"in {location.strip()}")

        search_query = " ".join(query_parts)

        params = {
            "query": search_query,
            "num_pages": "1",
            "country": "us",
            "date_posted": "all",
        }

        url = (
            "https://jsearch.p.rapidapi.com/search-v2?"
            + urllib.parse.urlencode(params)
        )

        request = urllib.request.Request(
            url,
            headers={
                "X-RapidAPI-Key": api_key,
                "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
                "Content-Type": "application/json",
            },
            method="GET",
        )

        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                raw_body = response.read().decode("utf-8")
                payload = json.loads(raw_body)

        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")

            raise HTTPException(
                status_code=502,
                detail=(
                    f"JSearch API returned HTTP {exc.code}: "
                    f"{error_body[:1000]}"
                ),
            ) from exc

        jobs = []

        for item in (payload.get("data") or [])[:8]:
            jobs.append({
                "id": item.get("job_id") or str(uuid.uuid4()),
                "title": item.get("job_title") or "Untitled role",
                "company": item.get("employer_name") or "Unknown company",
                "location": (
                    item.get("job_city")
                    or item.get("job_state")
                    or item.get("job_country")
                    or "Location not specified"
                ),
                "employment_type": (
                    item.get("job_employment_type") or ""
                ),
                "remote": bool(item.get("job_is_remote")),
                "salary": (
                    item.get("job_min_salary")
                    or item.get("job_max_salary")
                ),
                "salary_currency": (
                    item.get("job_salary_currency") or ""
                ),
                "url": (
                    item.get("job_apply_link")
                    or item.get("job_google_link")
                    or ""
                ),
                "description": (
                    item.get("job_description") or ""
                )[:350],
            })

        return {
            "configured": True,
            "jobs": jobs,
            "message": "",
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Live job search failed: {exc}"
        ) from exc

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
    files: list[UploadFile] = File(default=[]),
    file: UploadFile | None = File(None),
):
    """Route and execute a user request against up to 10 uploaded files."""
    uploaded_files = list(files)
    if file is not None:
        uploaded_files.insert(0, file)

    # De-duplicate the legacy single-file field if both fields were supplied.
    seen_ids = set()
    unique_files = []
    for uploaded in uploaded_files:
        marker = id(uploaded)
        if marker not in seen_ids:
            seen_ids.add(marker)
            unique_files.append(uploaded)
    uploaded_files = unique_files[:10]

    filenames = [f.filename or "unnamed file" for f in uploaded_files]
    filename = ", ".join(filenames) if filenames else None

    try:

        route = route_request(
            request=request,
            filename=filename,
        )

        tool = route["tool"]

        reason = route["reason"]

        file_payloads = []
        for uploaded in uploaded_files:
            file_payloads.append({
                "file": uploaded,
                "bytes": await uploaded.read(),
                "content_type": (uploaded.content_type or "").lower(),
                "filename": uploaded.filename or "unnamed file",
            })

        file_bytes = file_payloads[0]["bytes"] if file_payloads else None
        file = file_payloads[0]["file"] if file_payloads else None

        file_required_tools = {
            "remove_background",
            "pdf_to_word",
            "pdf_extract_text",
            "pdf_ask",
            "image_analyze",
            "image_to_pdf",
        }

        if (
            tool in file_required_tools
            and not file_payloads
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "This task requires "
                    "an uploaded file."
                ),
            )

        # ====================================================
        # IMAGE → PDF
        # ====================================================

        if tool == "image_to_pdf":

            if not file:
                raise HTTPException(
                    status_code=400,
                    detail="Please upload an image.",
                )

            content_type = (file.content_type or "").lower()
            if not content_type.startswith("image/"):
                raise HTTPException(
                    status_code=400,
                    detail="Image to PDF requires an image file.",
                )

            if not all(item["content_type"].startswith("image/") for item in file_payloads):
                raise HTTPException(
                    status_code=400,
                    detail="Image to PDF requires image files only.",
                )

            try:
                output = images_to_pdf(
                    [item["bytes"] for item in file_payloads]
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            except Exception as exc:
                raise HTTPException(
                    status_code=500,
                    detail=f"Image to PDF failed: {exc}",
                ) from exc

            return Response(
                content=output,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": (
                        'attachment; filename="mytoolbox-image.pdf"'
                    ),
                    "X-Toolbox-Tool": tool,
                    "X-Toolbox-Reason": reason,
                },
            )

        # ====================================================
        # IMAGE UNDERSTANDING
        # ====================================================

        if tool == "image_analyze":

            if not file:
                raise HTTPException(
                    status_code=400,
                    detail="Please upload an image.",
                )

            content_type = (file.content_type or "").lower()
            if not content_type.startswith("image/"):
                raise HTTPException(
                    status_code=400,
                    detail="Image understanding requires an image file.",
                )

            if not all(item["content_type"].startswith("image/") for item in file_payloads):
                raise HTTPException(
                    status_code=400,
                    detail="Image understanding requires image files only.",
                )

            try:
                answers = []
                for index, item in enumerate(file_payloads, start=1):
                    answer = analyze_image(
                        image_bytes=item["bytes"],
                        mime_type=item["content_type"],
                        request=request,
                    )
                    if len(file_payloads) > 1:
                        answers.append(f"Image {index} — {item['filename']}\n{answer}")
                    else:
                        answers.append(answer)
                answer = "\n\n".join(answers)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            except Exception as exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"Image understanding failed: {exc}",
                ) from exc

            return {
                "tool": "Image Understanding",
                "reason": reason,
                "answer": answer,
            }

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
# IMAGE FORMAT SUPPORT
# ============================================================

def decode_image_bytes(data: bytes):
    """Decode supported raster images, including HEIC/HEIF."""
    from PIL import Image, ImageOps

    try:
        # Register HEIC/HEIF support before Pillow attempts to open the file.
        # This is important because the browser may send HEIC with a generic MIME type.
        try:
            from pillow_heif import register_heif_opener
            register_heif_opener()
        except ImportError:
            pass

        image = Image.open(io.BytesIO(data))
        image.load()

        # Respect the camera orientation metadata before processing.
        try:
            image = ImageOps.exif_transpose(image)
        except Exception:
            pass

        return image
    except Exception as exc:
        raise ValueError(
            "Unsupported or invalid image file. Supported formats: PNG, JPG, JPEG, WebP, HEIC, and HEIF."
        ) from exc


# ============================================================
# IMAGE — REMOVE BACKGROUND
# ============================================================

@app.post(
    "/image/remove-background"
)
async def remove_background_endpoint(
    file: UploadFile = File(...),
):

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")

    try:
        decode_image_bytes(file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

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
# IMAGE TOOLBOX — RESIZE / CROP / CONVERT / COMPRESS
# ============================================================

@app.post("/image/process")
async def process_image_endpoint(
    file: UploadFile = File(...),
    operation: str = Form(...),
    output_format: str = Form("png"),
    quality: int = Form(85),
    keep_ratio: bool = Form(True),
    width: str = Form(""),
    height: str = Form(""),
    crop_x: str = Form("0"),
    crop_y: str = Form("0"),
    crop_width: str = Form(""),
    crop_height: str = Form(""),
):
    operation = operation.strip().lower()
    output_format = output_format.strip().lower()

    if operation not in {"resize", "crop", "convert", "compress", "background"}:
        raise HTTPException(status_code=400, detail="Unsupported image operation.")

    if output_format not in {"png", "jpg", "webp"}:
        raise HTTPException(status_code=400, detail="Unsupported output image format.")

    try:
        from PIL import Image

        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="The uploaded image is empty.")

        image = decode_image_bytes(data)

        if operation == "background":
            # rembg expects a standard raster input. Convert HEIC/HEIF
            # (and any other Pillow-readable input) to PNG first.
            source_for_rembg = io.BytesIO()
            image.save(source_for_rembg, format="PNG")
            output_bytes = remove_background(source_for_rembg.getvalue())
            processed = Image.open(io.BytesIO(output_bytes))
            processed.load()
            image = processed

        if operation == "resize":
            target_width = int(width) if width.strip() else None
            target_height = int(height) if height.strip() else None

            if target_width is None and target_height is None:
                raise HTTPException(status_code=400, detail="Enter a width or height for resizing.")

            if target_width is not None and target_width <= 0:
                raise HTTPException(status_code=400, detail="Width must be greater than zero.")
            if target_height is not None and target_height <= 0:
                raise HTTPException(status_code=400, detail="Height must be greater than zero.")

            original_width, original_height = image.size

            if keep_ratio:
                if target_width and target_height:
                    scale = min(
                        target_width / original_width,
                        target_height / original_height,
                    )
                    target_width = max(1, round(original_width * scale))
                    target_height = max(1, round(original_height * scale))
                elif target_width:
                    target_height = max(
                        1,
                        round(original_height * target_width / original_width),
                    )
                else:
                    target_width = max(
                        1,
                        round(original_width * target_height / original_height),
                    )

            else:
                target_width = target_width or original_width
                target_height = target_height or original_height

            image = image.resize(
                (target_width, target_height),
                Image.Resampling.LANCZOS,
            )

        elif operation == "crop":
            x = int(crop_x or "0")
            y = int(crop_y or "0")
            w = int(crop_width)
            h = int(crop_height)

            if x < 0 or y < 0 or w <= 0 or h <= 0:
                raise HTTPException(status_code=400, detail="Invalid crop dimensions.")

            if x + w > image.width or y + h > image.height:
                raise HTTPException(
                    status_code=400,
                    detail=f"Crop area is outside the image bounds ({image.width} × {image.height}).",
                )

            image = image.crop((x, y, x + w, y + h))

        quality = max(10, min(100, int(quality)))

        # JPEG cannot store transparency.
        if output_format == "jpg":
            if image.mode in {"RGBA", "LA"}:
                background = Image.new("RGB", image.size, "white")
                alpha = image.getchannel("A")
                background.paste(image.convert("RGB"), mask=alpha)
                image = background
            elif image.mode != "RGB":
                image = image.convert("RGB")

        elif output_format == "webp":
            if image.mode not in {"RGB", "RGBA"}:
                image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

        elif output_format == "png" and image.mode not in {"RGB", "RGBA", "L", "LA", "P"}:
            image = image.convert("RGBA")

        output = io.BytesIO()

        save_format = {
            "png": "PNG",
            "jpg": "JPEG",
            "webp": "WEBP",
        }[output_format]

        save_kwargs = {}
        if output_format in {"jpg", "webp"}:
            save_kwargs["quality"] = quality

        if output_format == "png":
            # PNG compression is lossless; quality is intentionally not used.
            save_kwargs["optimize"] = True

        image.save(output, format=save_format, **save_kwargs)

        media_type = {
            "png": "image/png",
            "jpg": "image/jpeg",
            "webp": "image/webp",
        }[output_format]

        return Response(
            content=output.getvalue(),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="processed-image.{output_format}"'
            },
        )

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image parameters: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


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
# ============================================================
# PDF → IMAGES
# ============================================================

@app.post("/pdf/to-images")
async def pdf_to_images_endpoint(
    file: UploadFile = File(...),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded PDF is empty.")

    try:
        document = fitz.open(stream=file_bytes, filetype="pdf")
        output = io.BytesIO()
        try:
            with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
                for index, page in enumerate(document, start=1):
                    pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                    archive.writestr(f"page-{index:03d}.png", pixmap.tobytes("png"))
        finally:
            document.close()

        return Response(
            content=output.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="pdf-pages.zip"'},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ============================================================
# PDF STRUCTURED DATA EXTRACTION
# ============================================================

@app.post("/pdf/extract-data")
async def pdf_extract_data_endpoint(
    file: UploadFile = File(...),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded PDF is empty.")

    try:
        pages = extract_pdf_text(file_bytes)
        readable_chars = sum(len(str(page.get("text", "")).strip()) for page in pages)
        ocr_used = readable_chars < 40

        if ocr_used:
            ocr_result = analyze_pdf(file_bytes)
            pages = [
                {"page": page.get("page"), "text": page.get("text", "")}
                for page in ocr_result.get("pages", [])
            ]

        data = extract_structured_data(pages)

        return {
            "data": data,
            "pages_used": [page.get("page") for page in pages if str(page.get("text", "")).strip()],
            "ocr_used": ocr_used,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))



# ============================================================
# PDF ORGANIZE
# ============================================================

@app.post("/pdf/organize")
async def pdf_organize_endpoint(
    operation: str = Form(...),
    files: list[UploadFile] = File(...),
    page_ranges: str = Form(""),
    page_order: str = Form(""),
):
    """
    Organize PDFs with one controlled endpoint:
    - merge: combine multiple PDFs
    - split: extract selected page ranges into a ZIP
    - reorder: create one PDF using a custom page order
    """
    operation = operation.strip().lower()
    if operation not in {"merge", "split", "reorder"}:
        raise HTTPException(
            status_code=400,
            detail="Unsupported PDF organize operation.",
        )

    if not files:
        raise HTTPException(
            status_code=400,
            detail="Please upload at least one PDF.",
        )

    if len(files) > 20:
        raise HTTPException(
            status_code=400,
            detail="You can organize up to 20 PDF files at once.",
        )

    documents = []
    try:
        for upload in files:
            if upload.content_type != "application/pdf":
                raise HTTPException(
                    status_code=400,
                    detail=f"{upload.filename or 'A file'} is not a PDF.",
                )

            data = await upload.read()
            if not data:
                raise HTTPException(
                    status_code=400,
                    detail=f"{upload.filename or 'A PDF'} is empty.",
                )

            try:
                documents.append(
                    fitz.open(stream=data, filetype="pdf")
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not read {upload.filename or 'the PDF'}: {exc}",
                ) from exc

        if operation == "merge":
            output = fitz.open()
            try:
                for document in documents:
                    output.insert_pdf(document)

                if output.page_count == 0:
                    raise HTTPException(
                        status_code=400,
                        detail="The uploaded PDFs contain no pages.",
                    )

                buffer = io.BytesIO()
                output.save(buffer, garbage=4, deflate=True)
                return Response(
                    content=buffer.getvalue(),
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": 'attachment; filename="merged.pdf"'
                    },
                )
            finally:
                output.close()

        if len(documents) != 1:
            raise HTTPException(
                status_code=400,
                detail="Split and reorder require exactly one PDF.",
            )

        source = documents[0]
        total_pages = source.page_count

        def parse_page_numbers(raw: str, *, allow_ranges: bool) -> list[int]:
            if not raw.strip():
                raise HTTPException(
                    status_code=400,
                    detail="Please specify the pages to process.",
                )

            result: list[int] = []
            seen: set[int] = set()

            for part in raw.split(","):
                token = part.strip()
                if not token:
                    continue

                if "-" in token:
                    if not allow_ranges:
                        raise HTTPException(
                            status_code=400,
                            detail="Reorder uses page numbers separated by commas; ranges are not supported there.",
                        )
                    pieces = token.split("-")
                    if len(pieces) != 2:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid page range: {token}",
                        )
                    try:
                        start = int(pieces[0].strip())
                        end = int(pieces[1].strip())
                    except ValueError as exc:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid page range: {token}",
                        ) from exc
                    if start > end:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid page range: {token}",
                        )
                    numbers = range(start, end + 1)
                else:
                    try:
                        numbers = [int(token)]
                    except ValueError as exc:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid page number: {token}",
                        ) from exc

                for number in numbers:
                    if number < 1 or number > total_pages:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Page {number} is outside the PDF's range (1-{total_pages}).",
                        )
                    if number not in seen:
                        result.append(number)
                        seen.add(number)

            if not result:
                raise HTTPException(
                    status_code=400,
                    detail="No valid pages were specified.",
                )

            return result

        if operation == "split":
            pages = parse_page_numbers(page_ranges, allow_ranges=True)
            output_zip = io.BytesIO()

            with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as archive:
                for index, page_number in enumerate(pages, start=1):
                    part = fitz.open()
                    try:
                        part.insert_pdf(source, from_page=page_number - 1, to_page=page_number - 1)
                        buffer = io.BytesIO()
                        part.save(buffer, garbage=4, deflate=True)
                        archive.writestr(
                            f"page-{page_number:03d}.pdf",
                            buffer.getvalue(),
                        )
                    finally:
                        part.close()

            return Response(
                content=output_zip.getvalue(),
                media_type="application/zip",
                headers={
                    "Content-Disposition": 'attachment; filename="split-pages.zip"'
                },
            )

        pages = parse_page_numbers(page_order, allow_ranges=False)
        if len(pages) != total_pages or set(pages) != set(range(1, total_pages + 1)):
            raise HTTPException(
                status_code=400,
                detail=f"Reorder must contain every page exactly once. Use all pages from 1 to {total_pages}.",
            )

        output = fitz.open()
        try:
            for page_number in pages:
                output.insert_pdf(
                    source,
                    from_page=page_number - 1,
                    to_page=page_number - 1,
                )

            buffer = io.BytesIO()
            output.save(buffer, garbage=4, deflate=True)
            return Response(
                content=buffer.getvalue(),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": 'attachment; filename="reordered.pdf"'
                },
            )
        finally:
            output.close()

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )
    finally:
        for document in documents:
            document.close()

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