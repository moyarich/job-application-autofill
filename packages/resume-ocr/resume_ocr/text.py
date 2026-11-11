"""Recover selectable PDF text, including vector-drawn list markers."""


from pypdfium2 import raw


def readable_length(text: str) -> int:
    """Count alphanumeric characters in extracted text."""
    return sum(character.isalnum() for character in text)


def _marker_positions(page):
    for obj in page.get_objects():
        if obj.type != raw.FPDF_PAGEOBJ_PATH:
            continue
        left, bottom, right, top = obj.get_bounds()
        width, height = right - left, top - bottom
        if (
            1 <= width <= 6
            and 1 <= height <= 6
            and 0.7 <= width / height <= 1.3
        ):
            yield right, (bottom + top) / 2


def _character_positions(text_page):
    for index in range(text_page.count_chars()):
        code = raw.FPDFText_GetUnicode(text_page, index)
        if not code or chr(code).isspace():
            continue
        left, bottom, _, top = text_page.get_charbox(index)
        yield index, left, bottom, top


def recover_vector_bullets(page, text_page) -> str:
    """Recover list markers drawn as shapes."""
    text = text_page.get_text_range()
    markers = list(_marker_positions(page))
    if not markers:
        return text

    characters = list(_character_positions(text_page))
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
