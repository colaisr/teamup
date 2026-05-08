import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from cryptography.fernet import Fernet
from jose import jwt

from app.config import settings


def hash_password(password: str) -> str:
    pw = password.encode("utf-8")
    if len(pw) > 72:
        raise ValueError("password cannot be longer than 72 bytes")
    hashed = bcrypt.hashpw(pw, bcrypt.gensalt(rounds=12))
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        pw = password.encode("utf-8")
        if len(pw) > 72:
            return False
        return bcrypt.checkpw(pw, password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expires_minutes)
    payload = {"sub": subject, "exp": expires}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def create_random_token() -> str:
    return secrets.token_urlsafe(32)


def _fernet() -> Fernet:
    if settings.encryption_key_base64 and settings.encryption_key_base64.strip():
        key = settings.encryption_key_base64.strip().encode("utf-8")
    else:
        # Fernet requires url-safe base64 of exactly 32 bytes; hash fixes dev key shape.
        raw32 = hashlib.sha256(b"teamup-dev-clickup-token-encryption").digest()
        key = base64.urlsafe_b64encode(raw32)
    return Fernet(key)


def encrypt_value(raw: str) -> str:
    return _fernet().encrypt(raw.encode("utf-8")).decode("utf-8")


def decrypt_value(cipher: str) -> str:
    return _fernet().decrypt(cipher.encode("utf-8")).decode("utf-8")

