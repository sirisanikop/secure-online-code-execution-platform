"""Pydantic request/response models (SAD 4.3)."""
import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")


class RegisterIn(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        if not USERNAME_RE.match(v):
            raise ValueError("Username must be 3-30 characters: letters, digits or underscore")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes")
        if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
            raise ValueError("Password must contain at least one letter and one digit")
        return v


class LoginIn(BaseModel):
    username: str
    password: str

    @field_validator("username", "password")
    @classmethod
    def _bounded(cls, v: str) -> str:
        if len(v) > 200:
            raise ValueError("Value too long")
        return v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    is_admin: bool = False


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ExecuteIn(BaseModel):
    # hard transport cap only; the configurable 50 KB / 16 KB limits are enforced (413) in the service
    code: str
    stdin: str = ""


class ExecutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    stdout: str
    stderr: str
    exit_code: int | None
    runtime_ms: int
    peak_mem_kb: int | None
    blocked_reason: str | None
    created_at: datetime


class ExecutionDetail(ExecutionOut):
    code: str
    stdin: str


class ExecutionSummary(BaseModel):
    id: int
    status: str
    runtime_ms: int
    created_at: datetime
    code_preview: str


class ExecutionList(BaseModel):
    items: list[ExecutionSummary]
    total: int


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_type: str
    user_id: int | None
    detail: str
    ip_address: str
    created_at: datetime


class AuditList(BaseModel):
    items: list[AuditEventOut]
    total: int
