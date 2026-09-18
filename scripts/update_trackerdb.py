#!/usr/bin/env python3
"""Rebuilds resources/trackerdb.txt from Ghostery's trackerdb releases.

Fetches the latest "trackerdb.txt" release asset from
https://github.com/ghostery/trackerdb (an adblock-style filter list, lines
like "||domain.com^" or "||domain.com^$3p"), then reproduces the same manual
steps SimpleCookie's list used to be rebuilt with by hand in Excel:

1. Keep only lines containing "||"
2. Drop the "||" anchor
3. Truncate at the first "/" (drops path suffixes, e.g. "/pixel.gif")
4. Truncate at the first "^" (drops adblock modifiers, e.g. "^$3p")
5. Deduplicate, sort A-Z, drop empty entries
6. Save as plain text (CRLF line endings, no trailing newline — matches the
   file's existing convention so the diff stays clean)

Usage:
    python3 scripts/update_trackerdb.py

Run from anywhere; it locates resources/trackerdb.txt relative to this
script, not the current working directory.
"""
import json
import pathlib
import subprocess

RELEASES_API_URL = "https://api.github.com/repos/ghostery/trackerdb/releases/latest"
OUTPUT_PATH = pathlib.Path(__file__).resolve().parent.parent / "resources" / "trackerdb.txt"


def _curl(url: str) -> bytes:
    # Shelling out to curl rather than urllib.request: some network setups
    # (proxies, sandboxes) mishandle GitHub's chunked responses with Python's
    # http.client and raise IncompleteRead, where curl handles the same
    # request fine.
    return subprocess.run(
        ["curl", "-sL", "--fail", url],
        check=True, capture_output=True,
    ).stdout


def fetch_latest_raw_trackerdb_txt() -> str:
    release = json.loads(_curl(RELEASES_API_URL))

    asset = next((a for a in release.get("assets", []) if a["name"] == "trackerdb.txt"), None)
    if not asset:
        raise RuntimeError(f"No 'trackerdb.txt' asset found in release {release.get('tag_name')}")

    print(f"Downloading trackerdb.txt from release {release.get('tag_name')} "
          f"({release.get('published_at')})...")
    return _curl(asset["browser_download_url"]).decode("utf-8", errors="replace")


def extract_domains(raw_text: str) -> list[str]:
    domains = set()
    for line in raw_text.splitlines():
        if "||" not in line:
            continue
        entry = line.replace("||", "", 1)

        slash_index = entry.find("/")
        if slash_index != -1:
            entry = entry[:slash_index]

        caret_index = entry.find("^")
        if caret_index != -1:
            entry = entry[:caret_index]

        entry = entry.strip()
        if entry:
            domains.add(entry)

    return sorted(domains)


def main() -> None:
    raw_text = fetch_latest_raw_trackerdb_txt()
    domains = extract_domains(raw_text)

    previous_count = None
    if OUTPUT_PATH.exists():
        previous_count = len([l for l in OUTPUT_PATH.read_text(encoding="utf-8").splitlines() if l.strip()])

    with open(OUTPUT_PATH, "w", encoding="utf-8", newline="") as f:
        f.write("\r\n".join(domains))

    if previous_count is not None:
        diff = len(domains) - previous_count
        sign = "+" if diff >= 0 else ""
        print(f"{OUTPUT_PATH.relative_to(OUTPUT_PATH.parent.parent)}: "
              f"{previous_count} -> {len(domains)} domains ({sign}{diff})")
    else:
        print(f"{OUTPUT_PATH.relative_to(OUTPUT_PATH.parent.parent)}: {len(domains)} domains")


if __name__ == "__main__":
    main()
