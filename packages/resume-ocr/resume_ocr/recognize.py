"""Rasterize one scanned PDF page and read it with RapidOCR."""


def recognize_page(page, ocr, dpi: int) -> str:
    bitmap = page.render(scale=dpi / 72)
    try:
        image = bitmap.to_pil()
        try:
            result = ocr(image)
            recognized = [
                str(line).strip()
                for line in (result.txts or [])
                if str(line).strip()
            ]
            return "\n".join(recognized)
        finally:
            image.close()
    finally:
        bitmap.close()
