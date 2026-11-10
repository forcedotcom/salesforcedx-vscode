"""Read Playwright HTML result metadata; copy only matching test-results videos.

Archives and report HTML are untrusted data. Never extract them or execute HTML.
Output paths are generated here, never taken from an archive or report.
"""

import base64
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import zipfile


def safe_entries(archive):
    entries = archive.infolist()
    names = [entry.filename for entry in entries]
    if len(set(names)) != len(names):
        raise ValueError("Duplicate ZIP paths")
    for entry in entries:
        path = PurePosixPath(entry.filename)
        # ZipInfo.filename has already normalized backslashes on Windows.
        if (path.is_absolute() or ".." in path.parts or "\\" in entry.orig_filename
                or ":" in entry.filename or stat.S_ISLNK(entry.external_attr >> 16)):
            raise ValueError("Unsafe ZIP path")
    return entries


def read_member(archive, name, limit):
    entry = archive.getinfo(name)
    if entry.file_size > limit:
        raise ValueError("Oversized ZIP member")
    return archive.read(entry)


def report_tests(report, spec, sha):
    safe_entries(report)
    html = read_member(report, "index.html", 32 * 1024 * 1024).decode("utf-8")
    # Playwright embeds a ZIP of JSON, not executable report data.
    match = re.search(r'id="playwrightReportBase64"[^>]*>\s*data:application/zip;base64,([A-Za-z0-9+/=]+)', html)
    if match is None:
        raise ValueError("Missing Playwright report metadata")
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(match[1], validate=True))) as metadata:
        safe_entries(metadata)
        summary = json.loads(read_member(metadata, "report.json", 32 * 1024 * 1024))
        if summary.get("metadata", {}).get("ci", {}).get("commitHash") != sha:
            raise ValueError("Playwright report SHA does not match PR head")
        files = [file for file in summary["files"] if spec.endswith("/" + file["fileName"].replace("\\", "/"))]
        if len(files) != 1:
            return []
        file = json.loads(read_member(metadata, files[0]["fileId"] + ".json", 32 * 1024 * 1024))
        return file["tests"]


def collect_videos(report_path, results_path, spec, sha, output, test_ids=None):
    with zipfile.ZipFile(report_path) as report, zipfile.ZipFile(results_path) as results:
        entries = safe_entries(results)
        selected = []
        for test in report_tests(report, spec, sha):
            if test_ids is not None and test["testId"] not in test_ids:
                continue
            final = test["results"][-1] if test["results"] else {}
            if final.get("status") != "passed" or test.get("outcome") not in ("expected", "flaky"):
                continue
            for attachment in final.get("attachments", []):
                if attachment.get("name") != "video" or attachment.get("contentType") != "video/webm":
                    continue
                path = attachment.get("path", "")
                if not re.fullmatch(r"data/[0-9a-f]{40}\.webm", path):
                    raise ValueError("Unexpected video attachment path")
                content = read_member(report, path, 100 * 1024 * 1024)
                selected.append((test, final, hashlib.sha256(content).hexdigest()))
        # Compare bytes, not names: HTML report attachment paths are content-hashed,
        # while test-results paths are derived from truncated test titles.
        wanted = {digest for _, _, digest in selected}
        videos = {}
        for entry in entries:
            if entry.filename.endswith(".webm") and entry.file_size <= 100 * 1024 * 1024:
                content = results.read(entry)
                digest = hashlib.sha256(content).hexdigest()
                if digest in wanted:
                    if not content.startswith(b"\x1a\x45\xdf\xa3") or b"webm" not in content[:128]:
                        raise ValueError("Invalid WebM video")
                    videos[digest] = content
        output = Path(output)
        output.mkdir(parents=True, exist_ok=True)
        found = []
        for test, final, digest in selected:
            if digest not in videos:
                print("Missing test-results video: " + test["title"], file=sys.stderr)
                continue
            path = output / (digest + ".webm")
            path.write_bytes(videos[digest])
            found.append({"path": str(path), "title": test["title"],
                          "project": test["projectName"], "retry": final["retry"]})
        return found


def collect_lane(pairs, spec, sha, output):
    # A --last-failed invocation replaces a report with a subset of tests. Merge
    # all job attempts by test ID and result start time, before filtering status.
    # Thus a later failure excludes an earlier success, but an omitted test stays.
    latest = {}
    for index, pair in enumerate(pairs):
        with zipfile.ZipFile(pair["report"]) as report:
            for test in report_tests(report, spec, sha):
                if not test["results"]:
                    continue
                timestamp = test["results"][-1]["startTime"]
                previous = latest.get(test["testId"])
                if previous is None or (timestamp, index) > previous:
                    latest[test["testId"]] = (timestamp, index)
    found = []
    for index, pair in enumerate(pairs):
        ids = {test_id for test_id, (_, source) in latest.items() if source == index}
        if ids:
            found.extend(collect_videos(pair["report"], pair["results"], spec, sha, output, ids))
    return found


if __name__ == "__main__":
    pairs_path, spec, sha, output = sys.argv[1:]
    print(json.dumps(collect_lane(json.loads(Path(pairs_path).read_text()), spec, sha, output)))
