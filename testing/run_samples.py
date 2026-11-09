"""Run every program in testing/sample_programs through the real validator + sandbox and compare with its
"# EXPECT: STATUS" header (optional "# STDIN: text" header). Exit code 0 only if all match.

Run with the back end's Python:   backend\\.venv\\Scripts\\python.exe testing\\run_samples.py
"""
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.sandbox.manager import BLOCKED, Limits, SandboxManager  # noqa: E402
from app.services.validator import validate  # noqa: E402


def header(src: str, key: str):
    for line in src.splitlines()[:5]:
        if line.startswith(f"# {key}:"):
            return line.split(":", 1)[1].strip()
    return None


def main() -> int:
    files = sorted((Path(__file__).parent / "sample_programs").glob("*.py"))
    limits = Limits(timeout_s=5, memory_mb=128, output_bytes=65536)
    failures = 0
    with tempfile.TemporaryDirectory(prefix="cb_samples_") as tmp:
        mgr = SandboxManager(tmp)
        print(f"{'program':28} {'expected':14} {'actual':14} {'ms':>6}  result")
        print("-" * 76)
        for f in files:
            src = f.read_text(encoding="utf-8")
            expect = header(src, "EXPECT")
            stdin = (header(src, "STDIN") or "") + ("\n" if header(src, "STDIN") else "")
            verdict = validate(src)
            if not verdict.ok:
                actual, ms = BLOCKED, 0
            else:
                r = mgr.run(src, stdin, limits)
                actual, ms = r.status, r.runtime_ms
            ok = actual == expect
            failures += not ok
            print(f"{f.name:28} {expect:14} {actual:14} {ms:6}  {'PASS' if ok else 'FAIL'}")
    print("-" * 76)
    print(f"{len(files) - failures}/{len(files)} samples behaved as expected")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
