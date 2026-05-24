#!/usr/bin/env python
"""
Convert .docx/.doc files to Markdown while exporting embedded images.

The .docx path is handled with Python's standard library. Legacy .doc files are
first converted to .docx by trying LibreOffice/soffice, then Microsoft Word COM
automation on Windows.
"""

import argparse
import os
import posixpath
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from urllib.parse import quote
from xml.etree import ElementTree as ET


NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

W = "{" + NS["w"] + "}"
A = "{" + NS["a"] + "}"
R_EMBED = "{" + NS["r"] + "}embed"
R_LINK = "{" + NS["r"] + "}link"
REL_NS = "{" + NS["rel"] + "}"

DOCX_MAIN_PART = "word/document.xml"
DOCX_MAIN_RELS = "word/_rels/document.xml.rels"

CODE_STYLE_KEYWORDS = (
    "code",
    "source",
    "program",
    "preformatted",
    "htmlpreformatted",
    "代码",
    "源码",
    "程序",
)

MONOSPACE_FONTS = {
    "consolas",
    "courier",
    "courier new",
    "lucida console",
    "menlo",
    "monaco",
    "source code pro",
}


class ConversionError(RuntimeError):
    pass


class ImageExporter:
    def __init__(self, docx_zip, relationships, image_dir, md_dir):
        self.docx_zip = docx_zip
        self.relationships = relationships
        self.image_dir = image_dir
        self.md_dir = md_dir
        self.by_relationship = {}
        self.by_part = {}
        self.counter = 1

    def export_blip(self, blip):
        rel_id = blip.attrib.get(R_EMBED)
        if rel_id:
            return self._export_embedded(rel_id)

        linked = blip.attrib.get(R_LINK)
        if linked:
            rel = self.relationships.get(linked)
            if rel:
                target = rel.get("target")
                if target:
                    return markdown_image_link("linked-image", target)
        return ""

    def _export_embedded(self, rel_id):
        if rel_id in self.by_relationship:
            return self.by_relationship[rel_id]

        rel = self.relationships.get(rel_id)
        if not rel:
            return ""

        target = rel.get("target")
        if not target:
            return ""

        part_name = resolve_docx_part("word/document.xml", target)
        if part_name in self.by_part:
            link = self.by_part[part_name]
            self.by_relationship[rel_id] = link
            return link

        try:
            image_bytes = self.docx_zip.read(part_name)
        except KeyError:
            return ""

        suffix = Path(PurePosixPath(part_name).name).suffix
        if not suffix:
            suffix = guess_image_suffix(image_bytes)

        image_name = "image_{:03d}{}".format(self.counter, suffix.lower())
        self.counter += 1
        self.image_dir.mkdir(parents=True, exist_ok=True)
        image_path = self.image_dir / image_name
        image_path.write_bytes(image_bytes)

        rel_path = image_path.relative_to(self.md_dir).as_posix()
        link = markdown_image_link(Path(image_name).stem, rel_path)
        self.by_part[part_name] = link
        self.by_relationship[rel_id] = link
        return link


def main():
    parser = argparse.ArgumentParser(
        description="Convert a .docx or .doc file to Markdown and export images."
    )
    parser.add_argument("input", type=Path, help="Input .docx or legacy .doc file")
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=Path("output"),
        help="Directory for the generated Markdown and image folder",
    )
    parser.add_argument(
        "--md-name",
        help="Markdown file name. Defaults to <input-file-name>.md",
    )
    parser.add_argument(
        "--image-dir-name",
        help="Image folder name. Defaults to <input-file-name>_images",
    )
    args = parser.parse_args()

    try:
        md_path, image_dir = convert_file(
            args.input,
            args.output_dir,
            md_name=args.md_name,
            image_dir_name=args.image_dir_name,
        )
    except ConversionError as exc:
        raise SystemExit(str(exc))

    print("Markdown: {}".format(md_path))
    print("Images: {}".format(image_dir))


def convert_file(input_path, output_dir=Path("output"), md_name=None, image_dir_name=None):
    input_path = Path(input_path).expanduser().resolve()
    output_dir = Path(output_dir).expanduser().resolve()

    if not input_path.exists():
        raise ConversionError("Input file does not exist: {}".format(input_path))

    output_dir.mkdir(parents=True, exist_ok=True)
    md_name = md_name or "{}.md".format(input_path.stem)
    image_dir_name = image_dir_name or "{}_images".format(input_path.stem)
    md_path = output_dir / md_name
    image_dir = output_dir / image_dir_name

    with tempfile.TemporaryDirectory(prefix="doc_to_md_") as tmp:
        docx_path = prepare_docx(input_path, Path(tmp))
        markdown = convert_docx_to_markdown(docx_path, md_path.parent, image_dir)
        md_path.write_text(markdown, encoding="utf-8")

    return md_path, image_dir


def prepare_docx(input_path, temp_dir):
    suffix = input_path.suffix.lower()
    if suffix == ".docx":
        return input_path
    if suffix == ".doc":
        return convert_doc_to_docx(input_path, temp_dir)
    raise ConversionError("Unsupported file type: {}".format(input_path.suffix))


def convert_doc_to_docx(input_path, temp_dir):
    failures = []
    target_path = temp_dir / "{}.docx".format(input_path.stem)

    try:
        converted = convert_with_libreoffice(input_path, temp_dir)
        if converted and converted.exists():
            return converted
    except Exception as exc:
        failures.append("LibreOffice: {}".format(exc))

    try:
        converted = convert_with_word(input_path, target_path)
        if converted and converted.exists():
            return converted
    except Exception as exc:
        failures.append("Microsoft Word: {}".format(exc))

    detail = "\n".join("- {}".format(item) for item in failures) or "- no converter found"
    raise ConversionError(
        "Could not convert legacy .doc to .docx. Install LibreOffice or Microsoft "
        "Word, then retry.\n{}".format(detail)
    )


def convert_with_libreoffice(input_path, temp_dir):
    soffice = find_soffice()
    if not soffice:
        raise ConversionError("soffice executable was not found")

    completed = subprocess.run(
        [
            str(soffice),
            "--headless",
            "--convert-to",
            "docx",
            "--outdir",
            str(temp_dir),
            str(input_path),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=180,
    )
    if completed.returncode != 0:
        message = (completed.stderr or completed.stdout or "").strip()
        raise ConversionError(message or "soffice returned non-zero exit code")

    converted = temp_dir / "{}.docx".format(input_path.stem)
    if not converted.exists():
        matches = list(temp_dir.glob("*.docx"))
        if matches:
            return matches[0]
        raise ConversionError("soffice finished but no .docx file was produced")
    return converted


def find_soffice():
    found = shutil.which("soffice")
    if found:
        return Path(found)

    candidates = [
        Path(r"C:\Program Files\LibreOffice\program\soffice.exe"),
        Path(r"C:\Program Files (x86)\LibreOffice\program\soffice.exe"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def convert_with_word(input_path, target_path):
    powershell = shutil.which("powershell.exe") or shutil.which("powershell")
    if not powershell:
        raise ConversionError("PowerShell was not found")

    script = r"""
try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
    $OutputEncoding = [Console]::OutputEncoding
}
catch {
}
$ErrorActionPreference = "Stop"
$source = [System.IO.Path]::GetFullPath($env:DOC_TO_MD_SOURCE)
$target = [System.IO.Path]::GetFullPath($env:DOC_TO_MD_TARGET)
$word = $null
$doc = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $word.Documents.Open($source, $false, $true)
    $format = 16
    $doc.SaveAs([ref] $target, [ref] $format)
}
finally {
    if ($doc -ne $null) { $doc.Close([ref] $false) | Out-Null }
    if ($word -ne $null) { $word.Quit() | Out-Null }
}
"""
    env = os.environ.copy()
    env["DOC_TO_MD_SOURCE"] = str(input_path)
    env["DOC_TO_MD_TARGET"] = str(target_path)

    completed = subprocess.run(
        [
            powershell,
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Sta",
            "-Command",
            script,
        ],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=180,
    )
    if completed.returncode != 0:
        message = (completed.stderr or completed.stdout or "").strip()
        raise ConversionError(message or "Word automation returned non-zero exit code")
    return target_path


def convert_docx_to_markdown(docx_path, md_dir, image_dir):
    with zipfile.ZipFile(docx_path) as docx_zip:
        document = ET.fromstring(docx_zip.read(DOCX_MAIN_PART))
        relationships = read_relationships(docx_zip)
        image_exporter = ImageExporter(docx_zip, relationships, image_dir, md_dir)

        body = document.find("w:body", NS)
        if body is None:
            return ""

        lines = []
        code_lines = []
        for block in iter_block_items(body):
            if block.tag == W + "p":
                text = inline_markdown(block, image_exporter).strip()
                if not text:
                    if code_lines and code_lines[-1] != "":
                        code_lines.append("")
                    continue

                if is_code_paragraph(block, text, bool(code_lines)):
                    code_lines.extend(text.splitlines())
                    continue

                flush_code_block(lines, code_lines)
                append_block(lines, paragraph_to_markdown_text(block, text))
            elif block.tag == W + "tbl":
                flush_code_block(lines, code_lines)
                table_lines = table_to_markdown(block, image_exporter)
                append_block(lines, table_lines)

        flush_code_block(lines, code_lines)

    return "\n".join(lines).rstrip() + "\n"


def read_relationships(docx_zip):
    relationships = {}
    try:
        rels_xml = docx_zip.read(DOCX_MAIN_RELS)
    except KeyError:
        return relationships

    root = ET.fromstring(rels_xml)
    for rel in root.findall(REL_NS + "Relationship"):
        rel_id = rel.attrib.get("Id")
        if rel_id:
            relationships[rel_id] = {
                "target": rel.attrib.get("Target", ""),
                "type": rel.attrib.get("Type", ""),
                "target_mode": rel.attrib.get("TargetMode", ""),
            }
    return relationships


def iter_block_items(parent):
    for child in list(parent):
        if child.tag in (W + "p", W + "tbl"):
            yield child
        else:
            for nested in iter_block_items(child):
                yield nested


def paragraph_to_markdown(paragraph, image_exporter, force_plain=False):
    text = inline_markdown(paragraph, image_exporter).strip()
    return paragraph_to_markdown_text(paragraph, text, force_plain=force_plain)


def paragraph_to_markdown_text(paragraph, text, force_plain=False):
    if not text:
        return []

    if not force_plain:
        level = heading_level(paragraph)
        if level:
            return ["{} {}".format("#" * level, text)]

    return text.splitlines()


def is_code_paragraph(paragraph, text, continuing=False):
    if heading_level(paragraph) or paragraph_has_numbered_heading_style(paragraph):
        return False
    if paragraph_has_code_style(paragraph) or paragraph_has_monospace_font(paragraph):
        return True
    return is_code_text(text, continuing=continuing)


def paragraph_has_numbered_heading_style(paragraph):
    p_style = paragraph.find("w:pPr/w:pStyle", NS)
    if p_style is None:
        return False
    value = p_style.attrib.get(W + "val", "")
    return bool(re.fullmatch(r"[1-9]", value.strip()))


def paragraph_has_code_style(paragraph):
    p_style = paragraph.find("w:pPr/w:pStyle", NS)
    if p_style is None:
        return False
    value = p_style.attrib.get(W + "val", "")
    normalized = re.sub(r"[\s_-]+", "", value).lower()
    return any(keyword in normalized for keyword in CODE_STYLE_KEYWORDS)


def paragraph_has_monospace_font(paragraph):
    fonts = []
    for r_fonts in paragraph.findall(".//w:rPr/w:rFonts", NS):
        for key in ("ascii", "hAnsi", "cs"):
            value = r_fonts.attrib.get(W + key)
            if value:
                fonts.append(value.lower())
    return bool(fonts) and all(font in MONOSPACE_FONTS for font in fonts)


def is_code_text(text, continuing=False):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return False
    return all(is_code_line(line, continuing=continuing) for line in lines)


def is_code_line(line, continuing=False):
    text = normalize_code_punctuation(line.strip())
    if not text:
        return False
    if looks_like_toc_or_heading(text) or starts_with_chinese_label(text):
        return False

    identifier = r"[A-Za-z_][A-Za-z0-9_]*"

    if text in ("{", "}", "{;", "};", "else", "else {", "else{"):
        return True
    if text in ("...", "…"):
        return continuing
    if re.match(r"^#\s*(include|define|if|ifdef|ifndef|endif|pragma|import)\b", text):
        return True
    if re.match(r"^(//|/\*|\*/)", text):
        return True
    if re.match(r"^(if|for|while|switch|catch)\s*\(", text, re.IGNORECASE):
        return True
    if re.match(r"^(do|try)\s*\{?$", text, re.IGNORECASE):
        return True
    if re.match(r"^(return|break|continue)\b", text):
        return True
    if re.match(r"^(else\s+if|else)\b", text, re.IGNORECASE):
        return True

    declaration = (
        r"^(const\s+|static\s+|unsigned\s+|signed\s+)*"
        r"(void|int|char|short|long|float|double|bool|BOOL|BYTE|DWORD|HANDLE|struct|enum|class)\b"
    )
    if re.match(declaration, text) and re.search(r"[;=({\[*]", text):
        return True

    if re.match(r"^" + identifier + r"\s*=", text):
        return True
    if re.match(r"^" + identifier + r"\s*\([^)]*\)\s*;?$", text):
        return True
    if re.match(r"^" + identifier + r"\s*=\s*" + identifier + r"\s*\(", text):
        return True
    if continuing and re.match(r"^" + identifier + r"\s*\(", text):
        return True
    if continuing and re.match(r"^[\"'].*[),;]$", text):
        return True
    if text.endswith(";") and re.search(identifier + r"\s*(=|\(|\[|\*)", text):
        return True
    if continuing and re.search(r"[{}();=,\[\]*&]", text) and not looks_like_sentence(text):
        return True

    return False


def normalize_code_punctuation(text):
    return (
        text.replace("“", '"')
        .replace("”", '"')
        .replace("‘", "'")
        .replace("’", "'")
        .replace("｛", "{")
        .replace("｝", "}")
    )


def looks_like_toc_or_heading(text):
    if re.match(r"^\d+(?:\.\d+)*\.?\s", text):
        return True
    if re.search(r"\t\s*-\s*\d+\s*-$", text):
        return True
    return False


def starts_with_chinese_label(text):
    return bool(re.match(r"^[\u4e00-\u9fff\s　]+[:：]", text))


def looks_like_sentence(text):
    code_markers = r"(//|/\*|\"|'|[A-Za-z_][A-Za-z0-9_]*\s*\()"
    if re.search(r"[。；：！？]", text) and not re.search(code_markers, text):
        return True
    return bool(re.search(r"[\u4e00-\u9fff]", text) and not re.search(r"(//|/\*|\"|')", text))


def flush_code_block(lines, code_lines):
    while code_lines and code_lines[0] == "":
        code_lines.pop(0)
    while code_lines and code_lines[-1] == "":
        code_lines.pop()

    if not code_lines:
        return

    non_empty = [line for line in code_lines if line.strip()]
    if len(non_empty) < 2:
        append_block(lines, non_empty)
    else:
        fence = code_fence_for(code_lines)
        language = guess_code_language(code_lines)
        append_block(lines, [fence + language] + code_lines + [fence])
    code_lines[:] = []


def code_fence_for(code_lines):
    max_run = 2
    for line in code_lines:
        for match in re.finditer(r"`+", line):
            max_run = max(max_run, len(match.group(0)))
    return "`" * (max_run + 1)


def guess_code_language(code_lines):
    text = "\n".join(code_lines)
    normalized = normalize_code_punctuation(text)
    if re.search(r"^\s*#\s*include\b", normalized, re.MULTILINE):
        return "c"
    if re.search(r"\b(int|char|unsigned|void|BOOL|DWORD)\b", normalized) and re.search(
        r"[{};]", normalized
    ):
        return "c"
    return ""


def heading_level(paragraph):
    p_style = paragraph.find("w:pPr/w:pStyle", NS)
    if p_style is None:
        return 0

    value = p_style.attrib.get(W + "val", "")
    normalized = re.sub(r"[\s_-]+", "", value).lower()

    if normalized in ("title",):
        return 1
    match = re.match(r"heading([1-9])$", normalized)
    if match:
        return int(match.group(1))
    return 0


def inline_markdown(node, image_exporter):
    parts = []
    collect_inline_parts(node, image_exporter, parts)
    return collapse_spaces_around_newlines("".join(parts))


def collect_inline_parts(node, image_exporter, parts):
    for child in list(node):
        if child.tag == W + "t":
            parts.append(child.text or "")
        elif child.tag == W + "tab":
            parts.append("\t")
        elif child.tag in (W + "br", W + "cr"):
            parts.append("\n")
        elif child.tag == A + "blip":
            image_link = image_exporter.export_blip(child)
            if image_link:
                parts.append(image_link)
        else:
            collect_inline_parts(child, image_exporter, parts)


def collapse_spaces_around_newlines(text):
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def table_to_markdown(table, image_exporter):
    rows = []
    max_columns = 0

    for tr in table.findall("w:tr", NS):
        row = []
        for tc in tr.findall("w:tc", NS):
            cell_text = cell_to_markdown(tc, image_exporter)
            span = cell_grid_span(tc)
            row.append(cell_text)
            for _ in range(span - 1):
                row.append("")
        if row:
            max_columns = max(max_columns, len(row))
            rows.append(row)

    if not rows or max_columns == 0:
        return []

    normalized_rows = [row + [""] * (max_columns - len(row)) for row in rows]
    header = [escape_table_cell(cell) for cell in normalized_rows[0]]
    separator = ["---"] * max_columns
    output = [
        "| {} |".format(" | ".join(header)),
        "| {} |".format(" | ".join(separator)),
    ]

    for row in normalized_rows[1:]:
        output.append("| {} |".format(" | ".join(escape_table_cell(cell) for cell in row)))
    return output


def cell_grid_span(cell):
    grid_span = cell.find("w:tcPr/w:gridSpan", NS)
    if grid_span is None:
        return 1
    try:
        return max(1, int(grid_span.attrib.get(W + "val", "1")))
    except ValueError:
        return 1


def cell_to_markdown(cell, image_exporter):
    parts = []
    for block in iter_block_items(cell):
        if block.tag == W + "p":
            paragraph = " ".join(paragraph_to_markdown(block, image_exporter, force_plain=True))
            if paragraph:
                parts.append(paragraph)
        elif block.tag == W + "tbl":
            nested = table_to_markdown(block, image_exporter)
            if nested:
                parts.append("<br>".join(nested))
    return "<br>".join(parts)


def escape_table_cell(value):
    escaped = value.replace("\\", "\\\\").replace("|", r"\|")
    escaped = escaped.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br>")
    return escaped.strip() or " "


def append_block(lines, block_lines):
    if not block_lines:
        return
    if lines and lines[-1] != "":
        lines.append("")
    lines.extend(block_lines)
    lines.append("")


def resolve_docx_part(source_part, target):
    if target.startswith("/"):
        return target.lstrip("/")
    base = posixpath.dirname(source_part)
    return posixpath.normpath(posixpath.join(base, target))


def markdown_image_link(alt_text, path_or_url):
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", path_or_url):
        href = path_or_url
    else:
        href = quote(path_or_url.replace("\\", "/"), safe="/._-()")
    alt = alt_text.replace("[", "(").replace("]", ")")
    return "![{}]({})".format(alt, href)


def guess_image_suffix(image_bytes):
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if image_bytes.startswith(b"GIF87a") or image_bytes.startswith(b"GIF89a"):
        return ".gif"
    if image_bytes.startswith(b"BM"):
        return ".bmp"
    return ".bin"


if __name__ == "__main__":
    main()
