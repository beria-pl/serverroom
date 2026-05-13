from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from ldap3 import ALL, Connection, Server
import pyotp
from sqlalchemy.orm import Session

from .config import settings
from .models import LocalUser


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    rounds = 200000
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), rounds).hex()
    return f"pbkdf2_sha256${rounds}${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    parts = stored_hash.split("$")
    if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
        return False
    _, rounds_str, salt, digest = parts
    rounds = int(rounds_str)
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), rounds).hex()
    return hmac.compare_digest(candidate, digest)


def authenticate_local_user(db: Session, username: str, password: str) -> LocalUser | None:
    user = db.query(LocalUser).filter(LocalUser.username == username).first()
    if not user or user.is_active != 1:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def ldap_authenticate(username: str, password: str) -> bool:
    if not settings.ldap_enabled:
        return False

    user_principal = f"{username}@{settings.ldap_domain}"
    server = Server(settings.ldap_server_uri, get_info=ALL)
    connection = Connection(server, user=user_principal, password=password, auto_bind=False)
    try:
        return connection.bind()
    finally:
        connection.unbind()


def create_access_token(subject: str, role: str, auth_source: str) -> tuple[str, datetime]:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "role": role, "auth_source": auth_source, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), expire


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def build_totp_provisioning_uri(secret: str, username: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=username, issuer_name=settings.totp_issuer or settings.app_name)


def normalize_otp_code(otp_code: str | None) -> str:
    return "".join(ch for ch in (otp_code or "") if ch.isdigit())


def verify_totp_code(secret: str | None, otp_code: str | None) -> bool:
    normalized = normalize_otp_code(otp_code)
    if not secret or len(normalized) != 6:
        return False
    return bool(pyotp.TOTP(secret).verify(normalized, valid_window=1))


def ensure_bootstrap_admin(db: Session) -> None:
    existing = db.query(LocalUser).filter(LocalUser.username == settings.bootstrap_admin_username).first()
    if existing:
        return

    bootstrap_user = LocalUser(
        username=settings.bootstrap_admin_username,
        password_hash=hash_password(settings.bootstrap_admin_password),
        role="admin",
        is_active=1,
    )
    db.add(bootstrap_user)
    db.commit()


def get_current_identity(token: str = Depends(oauth2_scheme)) -> dict[str, str]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        username: str | None = payload.get("sub")
        role: str = payload.get("role", "user")
        auth_source: str = payload.get("auth_source", "unknown")
        if username is None:
            raise credentials_exception
        return {"sub": username, "role": role, "auth_source": auth_source}
    except JWTError as exc:
        raise credentials_exception from exc


def get_current_user(identity: dict[str, str] = Depends(get_current_identity)) -> str:
    return identity["sub"]


def require_admin(identity: dict[str, str] = Depends(get_current_identity)) -> str:
    if identity.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return identity["sub"]
