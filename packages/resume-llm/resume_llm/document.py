"""Read resume documents locally and identify their source sections."""

from pathlib import Path
import re

HEADINGS = {
    "summary": (
        "summary",
        "professional summary",
        "profile",
        "professional profile",
        "objective",
    ),
    "experience": (
        "experience",
        "work experience",
        "professional experience",
        "employment history",
        "work history",
    ),
    "skills": ("skills", "technical skills", "core competencies"),
    "education": ("education", "academic background"),
    "certifications": (
        "certification",
        "certifications",
        "licenses and certifications",
    ),
    "projects": ("projects", "selected projects", "personal projects"),
    "languages": ("languages",),
    "awards": ("awards", "honors", "awards and honors"),
}
SECTION_KEYS = {heading: key for key, names in HEADINGS.items() for heading in names}
BULLET = re.compile(r"^(?:[•●▪◦*–-]|\d+[.)])\s+")


def read_document(path):
    """Read UTF-8 text or a PDF with a text layer."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        import pypdfium2

        pages = []
        with pypdfium2.PdfDocument(str(path)) as document:
            for page in document:
                try:
                    text_page = page.get_textpage()
                    try:
                        pages.append(text_page.get_text_range())
                    finally:
                        text_page.close()
                finally:
                    page.close()
        text = "\n\n".join(pages)
    elif suffix == ".txt":
        text = path.read_text(encoding="utf-8-sig")
    else:
        raise ValueError("Supported input files are PDF and UTF-8 text.")
    if not text.strip():
        raise ValueError("No readable text found. Provide an OCRed PDF or a text file.")
    return text


def split_sections(text):
    sections = {"contact": []}
    additional = []
    current = sections["contact"]
    for source_line in text.replace("\u0002", "-").replace("\u00ad", "-").splitlines():
        line = source_line.strip()
        heading = line.rstrip(":").strip()
        key = SECTION_KEYS.get(heading.casefold())
        if key:
            current = sections.setdefault(key, [])
        elif (
            current is not sections["contact"]
            and heading.isupper()
            and re.fullmatch(r"[A-Z][A-Z &/–-]{2,60}", heading)
        ):
            current = []
            additional.append((heading, current))
        else:
            current.append(line)
    return sections, additional


def paragraphs(lines):
    """Join physical wraps while preserving source bullets and blank lines."""
    items = []
    paragraph = ""
    for line in lines:
        if not line or BULLET.match(line):
            if paragraph:
                items.append(paragraph)
            paragraph = BULLET.sub("- ", line)
        else:
            paragraph = f"{paragraph} {line}" if paragraph else line
    if paragraph:
        items.append(paragraph)
    return "\n".join(items)
