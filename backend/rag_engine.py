import re

import numpy as np
from sentence_transformers import SentenceTransformer

from ai_client import generate_text


embedding_model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)


def chunk_pages(
    pages: list[dict],
    chunk_size: int = 1200,
    overlap: int = 200,
) -> list[dict]:

    chunks = []

    for page in pages:
        page_number = page["page"]
        text = page["text"].strip()

        if not text:
            continue

        text = re.sub(
            r"\s+",
            " ",
            text,
        )

        start = 0

        while start < len(text):

            end = start + chunk_size

            chunk_text = text[start:end].strip()

            if chunk_text:
                chunks.append({
                    "page": page_number,
                    "text": chunk_text,
                })

            if end >= len(text):
                break

            start = end - overlap

    return chunks


def retrieve_relevant_chunks(
    question: str,
    chunks: list[dict],
    top_k: int = 5,
) -> list[dict]:

    if not chunks:
        return []

    chunk_texts = [
        chunk["text"]
        for chunk in chunks
    ]

    chunk_embeddings = embedding_model.encode(
        chunk_texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    question_embedding = embedding_model.encode(
        question,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    similarities = np.dot(
        chunk_embeddings,
        question_embedding,
    )

    ranked_indices = np.argsort(
        similarities
    )[::-1]

    results = []

    for index in ranked_indices[:top_k]:

        chunk = chunks[index].copy()

        chunk["score"] = float(
            similarities[index]
        )

        results.append(chunk)

    return results


def answer_question(
    question: str,
    pages: list[dict],
) -> dict:

    chunks = chunk_pages(pages)

    relevant_chunks = retrieve_relevant_chunks(
        question,
        chunks,
        top_k=5,
    )

    if not relevant_chunks:
        return {
            "answer": (
                "I could not find enough information "
                "in the uploaded document to answer "
                "this question."
            ),
            "sources": [],
        }

    context_parts = []

    for chunk in relevant_chunks:

        context_parts.append(
            f"[Page {chunk['page']}]\n"
            f"{chunk['text']}"
        )

    context = "\n\n".join(
        context_parts
    )

    prompt = f"""
You are a document-grounded AI assistant.

Answer the user's question using ONLY the information
provided in the document context below.

Do not use outside knowledge.

If the answer cannot be determined from the provided
context, clearly say that the information was not found
in the uploaded document.

Keep the answer clear, accurate, and concise.

Mention the relevant page number or page numbers
when the information is available.

DOCUMENT CONTEXT:

{context}

USER QUESTION:

{question}
"""

    answer = generate_text(prompt)

    sources = sorted(
        set(
            chunk["page"]
            for chunk in relevant_chunks
        )
    )

    return {
        "answer": answer,
        "sources": sources,
    }