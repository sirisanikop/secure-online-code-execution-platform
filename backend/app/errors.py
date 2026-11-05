"""Uniform error type and response body (SAD 4.4)."""


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str, headers: dict | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.headers = headers or {}


def error_body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}
