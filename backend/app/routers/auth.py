from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..deps import client_ip, get_current_user, get_db
from ..models import User
from ..schemas import LoginIn, RegisterIn, TokenOut, UserOut
from ..services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    user = auth_service.register(db, request.app.state.settings, body.username, body.password)
    return user


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    st = request.app.state
    token, _ = auth_service.login(db, st.settings, st.limiter, body.username, body.password, client_ip(request))
    return TokenOut(access_token=token, expires_in=st.settings.jwt_expire_minutes * 60)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
