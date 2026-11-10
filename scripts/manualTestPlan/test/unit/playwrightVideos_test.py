import base64
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import zipfile

module = importlib.util.spec_from_file_location("playwrightVideos", Path(__file__).parents[2] / "playwrightVideos.py")
videos = importlib.util.module_from_spec(module)
module.loader.exec_module(videos)

SPEC = "packages/salesforcedx-vscode-apex-log/test/playwright/specs/executeAnonymous.headless.spec.ts"
CONTENT = b"\x1a\x45\xdf\xa3webm-final-video"
ATTACHMENT = "data/" + hashlib.sha1(CONTENT).hexdigest() + ".webm"


def archive_bytes(files):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            entry = zipfile.ZipInfo(name)
            # Preserve deliberately unsafe names instead of normalizing them on Windows.
            entry.filename = name
            archive.writestr(entry, content, compress_type=zipfile.ZIP_DEFLATED)
    return buffer.getvalue()


def result(status="passed", retry=0, path=ATTACHMENT, timestamp="2026-11-01T01:00:00Z"):
    return {"status": status, "retry": retry, "startTime": timestamp, "attachments": [
        {"name": "video", "contentType": "video/webm", "path": path}
    ]}


class PlaywrightVideosTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)

    def collect(self, attempts=None, outcome="expected", sha="head", files=None, attachment=ATTACHMENT,
                file_name="executeAnonymous.headless.spec.ts"):
        summary = {"metadata": {"ci": {"commitHash": "head"}}, "files": [
            {"fileName": file_name, "fileId": "123"}
        ]}
        test = {"testId": "test-123", "title": "Execute Anonymous", "projectName": "chromium", "outcome": outcome,
                "results": attempts if attempts is not None else [result(path=attachment)]}
        metadata = archive_bytes({"report.json": json.dumps(summary), "123.json": json.dumps({"tests": [test]})})
        html = '<template id="playwrightReportBase64">data:application/zip;base64,' + base64.b64encode(metadata).decode() + '</template>'
        report = self.directory / "report.zip"
        report.write_bytes(archive_bytes({"index.html": html, ATTACHMENT: CONTENT}))
        results = self.directory / "results.zip"
        # Deliberately unrelated name: mapping must come from metadata and content.
        results.write_bytes(archive_bytes(files if files is not None else {"truncated-unrelated-name/video.webm": CONTENT}))
        return videos.collect_videos(report, results, SPEC, sha, self.directory / "output")

    def test_metadata_maps_spec_to_video_not_filename(self):
        found = self.collect()
        self.assertEqual(len(found), 1)
        self.assertEqual(Path(found[0]["path"]).read_bytes(), CONTENT)
        self.assertEqual(found[0]["title"], "Execute Anonymous")

    def test_only_final_successful_attempt(self):
        found = self.collect([result("failed"), result("passed", 1)], "flaky")
        self.assertEqual([video["retry"] for video in found], [1])
        self.assertEqual(self.collect([result("passed"), result("failed", 1)], "unexpected"), [])
        self.assertEqual(self.collect([result("skipped")], "skipped"), [])
        self.assertEqual(self.collect([result("timedOut")], "unexpected"), [])

    def test_missing_video_does_not_guess(self):
        self.assertEqual(self.collect(files={"matching-spec-name/video.webm": b"different"}), [])

    def test_final_pass_without_video_does_not_use_failed_attempt_video(self):
        passed = result("passed", 1)
        passed["attachments"] = []
        self.assertEqual(self.collect([result("failed"), passed], "flaky"), [])

    def test_merge_job_attempts_before_filtering_final_status(self):
        self.collect()
        first = {}
        for kind in ["report", "results"]:
            source = self.directory / (kind + ".zip")
            destination = self.directory / ("first-" + kind + ".zip")
            destination.write_bytes(source.read_bytes())
            first[kind] = str(destination)
        latest = {kind: str(self.directory / (kind + ".zip")) for kind in ["report", "results"]}
        # A later --last-failed report omits a previously successful test.
        self.collect(file_name="another.spec.ts")
        found = videos.collect_lane([first, latest], SPEC, "head", self.directory / "merged")
        self.assertEqual(len(found), 1)
        # A later failure of that same test must exclude the earlier video.
        self.collect([result("failed", timestamp="2026-11-01T02:00:00Z")], "unexpected")
        self.assertEqual(videos.collect_lane([first, latest], SPEC, "head", self.directory / "merged"), [])

    def test_exact_report_sha(self):
        with self.assertRaisesRegex(ValueError, "SHA"):
            self.collect(sha="other-head")

    def test_report_paths_cannot_escape_or_attach_other_types(self):
        for path in ["../../secret.webm", "/secret.webm", "data/test.png", "data/evil.webm"]:
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "Unexpected video"):
                self.collect(attachment=path)

    def test_archive_traversal_and_symlinks_rejected(self):
        for path in ["../outside.webm", "/outside.webm", "C:/outside.webm", "test\\outside.webm"]:
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "Unsafe ZIP"):
                self.collect(files={path: CONTENT})
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            entry = zipfile.ZipInfo("video.webm")
            entry.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(entry, "/secret")
        with zipfile.ZipFile(io.BytesIO(buffer.getvalue())) as archive:
            with self.assertRaisesRegex(ValueError, "Unsafe ZIP"):
                videos.safe_entries(archive)

    def test_archive_backslashes_rejected_after_windows_normalization(self):
        raw = archive_bytes({"test\\outside.webm": CONTENT})
        with patch("zipfile.os.sep", "\\"), zipfile.ZipFile(io.BytesIO(raw)) as archive:
            self.assertEqual(archive.infolist()[0].filename, "test/outside.webm")
            with self.assertRaisesRegex(ValueError, "Unsafe ZIP"):
                videos.safe_entries(archive)


if __name__ == "__main__":
    unittest.main()
