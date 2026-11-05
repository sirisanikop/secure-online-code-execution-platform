"""Keep the repository-level CI (`python -m pytest` on Ubuntu with only pytest installed) green.

The back-end suite needs Windows (the sandbox uses Job Objects) and the packages in backend/requirements.txt.
When either is missing, these tests are not collected; run them on Windows after `pip install -r backend/requirements.txt`.
"""
import importlib.util
import os

collect_ignore = []
if os.name != "nt" or any(importlib.util.find_spec(m) is None for m in ("fastapi", "sqlalchemy", "jwt", "bcrypt", "httpx")):
    collect_ignore = ["tests"]
