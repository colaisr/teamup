from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.authz import user_is_platform_admin
from app.database import get_db
from app.deps import get_current_user
from app.config import settings
from app.emailer import send_email_or_log
from app.models import EmailVerificationToken, User
from app.schemas import (
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    TokenResponse,
    UserOut,
    VerifyEmailRequest,
)
from app.security import create_access_token, create_random_token, hash_password, verify_password
from app.services.workspaces import ensure_personal_workspace, sync_last_active_workspace

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=MessageResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        is_verified=False,
    )
    db.add(user)
    db.flush()
    ensure_personal_workspace(db, user)
    sync_last_active_workspace(db, user)
    db.flush()
    token = create_random_token()
    verification = EmailVerificationToken(user_id=user.id, token=token)
    db.add(verification)
    db.commit()

    verify_link = f"/verify-email?token={token}"
    body = (
        f"Здравствуйте!\n\nПодтвердите вашу почту: {verify_link}\n\nЕсли это не вы, просто игнорируйте письмо."
    )
    sent = send_email_or_log(
        to_email=user.email,
        subject="Подтверждение регистрации TeamUp",
        body=body,
    )
    if sent:
        return MessageResponse(message="Регистрация успешна. Проверьте почту для подтверждения.")
    if settings.app_env == "development":
        return MessageResponse(
            message=(
                "Аккаунт создан, но письмо не отправлено (SMTP недоступен). "
                f"Для разработки откройте ссылку подтверждения: {verify_link}"
            )
        )
    return MessageResponse(
        message="Аккаунт создан, но письмо не удалось отправить. Обратитесь к администратору или повторите позже."
    )


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    token_row = db.query(EmailVerificationToken).filter(EmailVerificationToken.token == payload.token).first()
    if not token_row or token_row.used_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")
    if token_row.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token expired")

    user = db.query(User).filter(User.id == token_row.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_verified = True
    token_row.used_at = datetime.utcnow()
    db.commit()
    return MessageResponse(message="Почта подтверждена.")


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")
    ensure_personal_workspace(db, user)
    sync_last_active_workspace(db, user)
    db.commit()
    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
def me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    u = db.query(User).filter(User.id == current_user.id).first()
    ensure_personal_workspace(db, u)
    sync_last_active_workspace(db, u)
    db.commit()
    db.refresh(u)
    return UserOut(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        is_verified=u.is_verified,
        is_system_admin=user_is_platform_admin(u),
        last_active_workspace_id=u.last_active_workspace_id,
    )

