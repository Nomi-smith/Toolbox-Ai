import os
from google import genai
from google.genai import types


def _is_temporary_error(error: Exception) -> bool:
    """Check whether Gemini returned a temporary availability/rate-limit error."""
    message = str(error).upper()

    return any(
        code in message
        for code in [
            "503",
            "UNAVAILABLE",
            "429",
            "RESOURCE_EXHAUSTED",
            "HIGH DEMAND",
            "RATE LIMIT",
        ]
    )


def analyze_image(image_bytes: bytes, mime_type: str, request: str) -> str:
    """
    Analyze an uploaded image using Gemini vision.

    Primary model is tried first.
    If Gemini temporarily fails (503/429), a fallback model is attempted.
    """

    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured on the backend."
        )

    primary_model = os.getenv(
        "GEMINI_VISION_MODEL",
        "gemini-3.7-flash",
    ).strip()

    fallback_model = os.getenv(
        "GEMINI_VISION_FALLBACK_MODEL",
        "gemini-2.5-flash",
    ).strip()

    client = genai.Client(api_key=api_key)

    prompt = f"""
You are the image understanding capability inside MyToolbox AI.

Understand the uploaded image and answer the user's request naturally.

User request:
{request}

Important instructions:
- Understand casual wording and spelling mistakes.
- Infer the user's intended meaning when the wording is imperfect.
- Carefully inspect the image before answering.
- If the user asks what the image is about, give a clear concise explanation.
- If the image contains text, read and explain the relevant text when useful.
- Do not invent details that cannot be seen or reasonably inferred.
- If something is unclear, say that it is unclear.
- Answer directly instead of explaining your internal process.
"""

    contents = [
        types.Part.from_bytes(
            data=image_bytes,
            mime_type=mime_type,
        ),
        prompt,
    ]

    # Don't try the same overloaded model repeatedly.
    # Try primary once, then immediately move to fallback.
    models_to_try = [primary_model]

    if fallback_model and fallback_model != primary_model:
        models_to_try.append(fallback_model)

    last_error = None

    for index, model in enumerate(models_to_try):
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
            )

            text = getattr(response, "text", None)

            if text and text.strip():
                return text.strip()

            raise RuntimeError(
                f"Gemini returned an empty response using {model}."
            )

        except Exception as error:
            last_error = error

            # If this is not a temporary availability/rate-limit problem,
            # don't hide the real error by trying unrelated models.
            if not _is_temporary_error(error):
                raise RuntimeError(
                    f"Image understanding failed: {error}"
                ) from error

            # Temporary error:
            # continue to fallback model if one is available.
            if index < len(models_to_try) - 1:
                continue

    raise RuntimeError(
        "Image understanding is temporarily unavailable. "
        f"Gemini models '{primary_model}' and "
        f"'{fallback_model}' could not process the image right now. "
        "Please try again in a moment."
    ) from last_error