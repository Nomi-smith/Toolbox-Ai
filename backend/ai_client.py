import os
import re

from dotenv import load_dotenv
from google import genai

try:
    from groq import Groq
except ImportError:
    Groq = None


load_dotenv()


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")


GEMINI_MODEL = "gemini-3.5-flash"
GROQ_MODEL = "qwen/qwen3.6-27b"


gemini_client = None
groq_client = None


if GEMINI_API_KEY:
    gemini_client = genai.Client(
        api_key=GEMINI_API_KEY
    )


if GROQ_API_KEY and Groq:
    groq_client = Groq(
        api_key=GROQ_API_KEY
    )


def _is_rate_limit_error(exc: Exception) -> bool:
    """
    Detect Gemini quota/rate-limit errors.
    """

    message = str(exc).lower()

    rate_limit_indicators = [
        "429",
        "rate limit",
        "quota",
        "resource exhausted",
        "too many requests",
        "free_tier",
        "free tier",
    ]

    return any(
        indicator in message
        for indicator in rate_limit_indicators
    )


def _clean_json_output(text: str) -> str:
    """
    Remove Markdown code fences around JSON if present.
    """

    text = text.strip()

    if text.startswith("```"):
        text = re.sub(
            r"^```(?:json)?\s*",
            "",
            text,
            flags=re.IGNORECASE,
        )

        text = re.sub(
            r"\s*```$",
            "",
            text,
        )

    return text.strip()


def generate_text(
    prompt: str,
    *,
    json_output: bool = False,
) -> str:
    """
    Use Gemini first.

    If Gemini hits a quota/rate-limit error,
    automatically fall back to Groq.
    """

    if not gemini_client:

        if groq_client:
            return _generate_with_groq(
                prompt,
                json_output=json_output,
            )

        raise RuntimeError(
            "No AI provider is configured. "
            "Please add GEMINI_API_KEY or GROQ_API_KEY "
            "to the .env file."
        )

    try:

        interaction = gemini_client.interactions.create(
            model=GEMINI_MODEL,
            input=prompt,
            store=False,
        )

        output = interaction.output_text.strip()

        if json_output:
            output = _clean_json_output(output)

        return output

    except Exception as exc:

        if not _is_rate_limit_error(exc):
            raise

        if not groq_client:
            raise RuntimeError(
                "Gemini reached its rate limit/quota, "
                "and GROQ_API_KEY is not configured."
            ) from exc

        return _generate_with_groq(
            prompt,
            json_output=json_output,
        )


def _generate_with_groq(
    prompt: str,
    *,
    json_output: bool = False,
) -> str:
    """
    Generate text using Groq.
    """

    if not groq_client:
        raise RuntimeError(
            "Groq is not configured. "
            "Please add GROQ_API_KEY to the .env file."
        )

    completion = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an AI assistant inside Toolbox AI. "
                    "Follow the user's instructions precisely. "
                    "Do not invent information."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.1,
    )

    output = completion.choices[0].message.content.strip()

    if json_output:
        output = _clean_json_output(output)

    return output


def get_ai_provider_status() -> dict:
    """
    Return basic provider availability for debugging.
    """

    return {
        "gemini_configured": gemini_client is not None,
        "gemini_model": GEMINI_MODEL,
        "groq_configured": groq_client is not None,
        "groq_model": GROQ_MODEL,
    }