"""
Phase 1: Mechanical inline style → Tailwind class replacement.

Handles single-property style={{ prop: "value" }} where the value maps
to a known Tailwind token from globals.css @theme.

Multi-property styles are flagged for manual review, not auto-transformed.
Dynamic/conditional styles are skipped entirely.
"""
import re, sys, os
from pathlib import Path

# ── Color mappings: (css-prop, hex) → tailwind class ──────────────
COLOR_MAP = {
    # color → text-*
    ("color", "#517AB7"): "text-accent",
    ("color", "#777777"): "text-text-muted",
    ("color", "#333333"): "text-text-body",
    ("color", "#0B1215"): "text-text-dark",
    ("color", "#3B276A"): "text-primary",
    ("color", "#CC2200"): "text-alert",
    ("color", "#746EB1"): "text-secondary",
    ("color", "#ffffff"): "text-white",
    ("color", "#FFFFFF"): "text-white",
    ("color", "#2E7D32"): "text-success",
    ("color", "#2F6F44"): "text-[#2F6F44]",
    ("color", "#8A4B08"): "text-[#8A4B08]",
    ("color", "#B42318"): "text-[#B42318]",
    ("color", "#555555"): "text-[#555555]",
    ("color", "#999999"): "text-[#999999]",
    ("color", "#666666"): "text-[#666666]",
    # backgroundColor → bg-*
    ("backgroundColor", "#F9F9F9"): "bg-nav-bg",
    ("backgroundColor", "#3B276A"): "bg-primary",
    ("backgroundColor", "#F0F0F0"): "bg-row-alt",
    ("backgroundColor", "#FFFFFF"): "bg-surface",
    ("backgroundColor", "#ffffff"): "bg-white",
    ("backgroundColor", "#E7E9EC"): "bg-[#E7E9EC]",
    ("backgroundColor", "#EEF2FF"): "bg-[#EEF2FF]",
    ("backgroundColor", "#746EB1"): "bg-secondary",
    ("backgroundColor", "#4D3880"): "bg-primary-hover",
    ("backgroundColor", "#FFF4F2"): "bg-[#FFF4F2]",
    ("backgroundColor", "#FFF8E7"): "bg-status-queued-bg",
    ("backgroundColor", "#E8F5E9"): "bg-status-complete-bg",
    ("backgroundColor", "#FFF0EE"): "bg-status-failed-bg",
    # borderColor → border-*
    ("borderColor", "#E7E9EC"): "border-border-subtle",
    ("borderColor", "#D6DADE"): "border-[#D6DADE]",
    ("borderColor", "#746EB1"): "border-secondary",
    ("borderColor", "#F4CCCC"): "border-[#F4CCCC]",
    ("borderColor", "#D0D0D0"): "border-border-table",
    ("borderColor", "#C5C0E8"): "border-[#C5C0E8]",
    ("borderColor", "#C8E6C9"): "border-[#C8E6C9]",
    ("borderColor", "#FFCDD2"): "border-[#FFCDD2]",
    ("borderColor", "#CCCCB4"): "border-[#CCCCB4]",
    ("borderColor", "#E0E0E0"): "border-[#E0E0E0]",
}

# ── Regex for single-property style={{ prop: "hex" }} ─────────────
# Matches: style={{ color: "#517AB7" }} or style={{ backgroundColor: "#F9F9F9" }}
# Does NOT match multi-property, dynamic, or conditional styles.
SINGLE_STYLE_RE = re.compile(
    r'style=\{\{\s*'
    r'(color|backgroundColor|borderColor)'
    r':\s*"(#[A-Fa-f0-9]{3,8})"'
    r'\s*\}\}'
)

# className="..." immediately before a style prop (with optional whitespace/newline between)
CLASSNAME_BEFORE_RE = re.compile(
    r'(className="[^"]*")'
    r'(\s*)'
    r'style=\{\{\s*(color|backgroundColor|borderColor):\s*"(#[A-Fa-f0-9]{3,8})"\s*\}\}'
)

# style prop before className="..." 
STYLE_BEFORE_CLASSNAME_RE = re.compile(
    r'style=\{\{\s*(color|backgroundColor|borderColor):\s*"(#[A-Fa-f0-9]{3,8})"\s*\}\}'
    r'(\s*)'
    r'(className="[^"]*")'
)

stats = {"replaced": 0, "skipped_no_mapping": 0, "files_changed": 0}

def get_tw_class(prop, value):
    return COLOR_MAP.get((prop, value))

def replace_classname_before(match):
    """className="foo" style={{ color: "#hex" }} → className="foo tw-class" """
    cn_attr = match.group(1)  # className="..."
    ws = match.group(2)
    prop = match.group(3)
    value = match.group(4)
    tw = get_tw_class(prop, value)
    if not tw:
        stats["skipped_no_mapping"] += 1
        return match.group(0)
    # Insert tw class before closing quote of className
    new_cn = cn_attr[:-1] + " " + tw + '"'
    stats["replaced"] += 1
    return new_cn

def replace_style_before_classname(match):
    """style={{ color: "#hex" }} className="foo" → className="foo tw-class" """
    prop = match.group(1)
    value = match.group(2)
    ws = match.group(3)
    cn_attr = match.group(4)
    tw = get_tw_class(prop, value)
    if not tw:
        stats["skipped_no_mapping"] += 1
        return match.group(0)
    new_cn = cn_attr[:-1] + " " + tw + '"'
    stats["replaced"] += 1
    return new_cn

def replace_standalone_style(match):
    """style={{ color: "#hex" }} (no className nearby) → className="tw-class" """
    prop = match.group(1)
    value = match.group(2)
    tw = get_tw_class(prop, value)
    if not tw:
        stats["skipped_no_mapping"] += 1
        return match.group(0)
    stats["replaced"] += 1
    return f'className="{tw}"'

def process_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    original = content

    # Pass 1: className BEFORE style (most common pattern)
    content = CLASSNAME_BEFORE_RE.sub(replace_classname_before, content)
    # Pass 2: style BEFORE className
    content = STYLE_BEFORE_CLASSNAME_RE.sub(replace_style_before_classname, content)
    # Pass 3: standalone style (no adjacent className)
    content = SINGLE_STYLE_RE.sub(replace_standalone_style, content)

    if content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        stats["files_changed"] += 1
        return True
    return False

def main():
    src_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("src")
    if not src_dir.exists():
        print(f"ERROR: {src_dir} not found. Run from repo root.")
        sys.exit(1)

    tsx_files = sorted(src_dir.rglob("*.tsx"))
    ts_files = [f for f in sorted(src_dir.rglob("*.ts"))
                if not f.name.endswith((".test.ts", ".spec.ts"))]
    all_files = [f for f in tsx_files + ts_files
                 if ".test." not in f.name and ".spec." not in f.name]

    print(f"Scanning {len(all_files)} files...")
    changed = []
    for filepath in all_files:
        if process_file(filepath):
            changed.append(filepath)
            print(f"  CHANGED: {filepath.relative_to(src_dir.parent)}")

    print(f"\n=== Phase 1 Results ===")
    print(f"  Files scanned:   {len(all_files)}")
    print(f"  Files changed:   {stats['files_changed']}")
    print(f"  Styles replaced: {stats['replaced']}")
    print(f"  Skipped (no map): {stats['skipped_no_mapping']}")

    # Report remaining inline styles
    remaining = 0
    for filepath in all_files:
        with open(filepath, "r", encoding="utf-8") as f:
            for i, line in enumerate(f, 1):
                if "style=" in line and "style={" in line:
                    remaining += 1
    print(f"  Remaining style=: {remaining}")

if __name__ == "__main__":
    main()
