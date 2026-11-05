"""FastAPI dependencies: DB session, current user, admin check."""
import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .errors import AppError
from .models import User
from .security import decode_token

_bearer = HTTPBearer(auto_error=False)


def get_db(request: Request):
    db = request.app.state.session_factory()
    try:
        yield db
    finally:
        db.close()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else ""


def get_current_user(request: Request, creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
                     db: Session = Depends(get_db)) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise AppError(401, "NOT_AUTHENTICATED", "Authentication required", {"WWW-Authenticate": "Bearer"})
    try:
        claims = decode_token(creds.credentials, request.app.state.settings.jwt_secret)
        user = db.get(User, int(claims["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError):
        user = None
    if user is None:
        raise AppError(401, "INVALID_TOKEN", "Invalid or expired token", {"WWW-Authenticate": "Bearer"})
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise AppError(403, "FORBIDDEN", "Administrator access required")
    return user
