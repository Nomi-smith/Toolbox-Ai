from io import BytesIO

from PIL import Image
from rembg import remove


MAX_PROCESS_SIZE = 1600


def remove_background(image_bytes: bytes) -> bytes:
    """
    Remove the background from an image while safely handling
    large images.

    The AI segmentation model processes a resized version
    to reduce memory usage. The resulting alpha mask is then
    resized back to the original image dimensions so the
    final output keeps the original resolution.
    """

    input_image = Image.open(
        BytesIO(image_bytes)
    ).convert("RGBA")

    original_width, original_height = input_image.size

    # Calculate a processing size that keeps the aspect ratio.
    scale = min(
        1.0,
        MAX_PROCESS_SIZE / max(
            original_width,
            original_height,
        ),
    )

    if scale < 1.0:

        process_width = max(
            1,
            int(original_width * scale),
        )

        process_height = max(
            1,
            int(original_height * scale),
        )

        process_image = input_image.resize(
            (
                process_width,
                process_height,
            ),
            Image.Resampling.LANCZOS,
        )

    else:
        process_image = input_image

    # Run background removal on the smaller image.
    output_image = remove(
        process_image
    ).convert("RGBA")

    # Resize the result back to the original dimensions.
    if output_image.size != (
        original_width,
        original_height,
    ):

        output_image = output_image.resize(
            (
                original_width,
                original_height,
            ),
            Image.Resampling.LANCZOS,
        )

    output_buffer = BytesIO()

    output_image.save(
        output_buffer,
        format="PNG",
    )

    return output_buffer.getvalue()