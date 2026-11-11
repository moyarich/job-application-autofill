"""Recover selectable PDF text, including vector-drawn list markers."""


def readable_length(text: str) -> int:
    return sum(character.isalnum() for character in text)


def recover_vector_bullets(page, text_page) -> str:
    """Recover small drawn list markers which PDF text extraction cannot see."""
    from pypdfium2 import raw

    text = text_page.get_text_range()
    markers = []
    for obj in page.get_objects():
        if obj.type != raw.FPDF_PAGEOBJ_PATH:
            continue
        left, bottom, right, top = obj.get_bounds()
        width, height = right - left, top - bottom
        if 1 <= width <= 6 and 1 <= height <= 6 and 0.7 <= width / height <= 1.3:
            markers.append((right, (bottom + top) / 2))
    if not markers:
        return text

    characters = []
    for index in range(text_page.count_chars()):
        code = raw.FPDFText_GetUnicode(text_page, index)
        if not code or chr(code).isspace():
            continue
        left, bottom, right, top = text_page.get_charbox(index)
        characters.append((index, left, bottom, top))
    insertions = set()
    for marker_right, center in markers:
        candidates = [
            (index, left)
            for index, left, bottom, top in characters
            if 0 < left - marker_right < 18 and bottom - 2 <= center <= top + 2
        ]
        if not candidates:
            continue
        index, _ = min(candidates, key=lambda item: item[1])
        prefix = text_page.get_text_range(0, index) if index else ""
        if not prefix.rsplit("\n", 1)[-1].strip():
            insertions.add(len(prefix))
    for offset in sorted(insertions, reverse=True):
        text = text[:offset] + "• " + text[offset:]
    return text
