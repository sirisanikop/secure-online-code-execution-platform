"""In-memory sliding-window rate limiter (DS-EXE-01, DS-AUTH-02)."""
import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self):
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_s: float) -> tuple[bool, int]:
        """Record a hit. Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] >= window_s:
                q.popleft()
            if len(q) >= limit:
                return False, max(1, int(window_s - (now - q[0])) + 1)
            q.append(now)
            return True, 0

    def peek_blocked(self, key: str, limit: int, window_s: float) -> tuple[bool, int]:
        """Is the key currently over the limit? (does not record a hit)"""
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] >= window_s:
                q.popleft()
            if len(q) >= limit:
                return True, max(1, int(window_s - (now - q[0])) + 1)
            return False, 0

    def record(self, key: str) -> None:
        with self._lock:
            self._hits[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)
