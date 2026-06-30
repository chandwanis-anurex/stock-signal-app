import os
import random
import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import sendgrid
from sendgrid.helpers.mail import Mail

from app.database import get_db
from app.models.models import User
from app.auth import hash_password, verify_password, create_token
from app.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory store: email -> (code, expiry_timestamp)
_reset_codes: dict = {}


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register", status_code=201)
@limiter.limit("5/minute")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": create_token(user.id), "user_id": user.id, "email": user.email}



class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


@router.post("/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account with that email")
    code = str(random.randint(100000, 999999))
    _reset_codes[payload.email] = (code, time.time() + 600)  # 10 min expiry
    sg = sendgrid.SendGridAPIClient(api_key=os.getenv("SENDGRID_API_KEY", ""))
    mail = Mail(
        from_email=os.getenv("ALERT_FROM_EMAIL", "noreply@signalflow.app"),
        to_emails=payload.email,
        subject="SignalFlow — Password Reset Code",
        plain_text_content=f"Your SignalFlow password reset code is: {code}\n\nThis code expires in 10 minutes.",
    )
    sg.send(mail)
    return {"ok": True}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    entry = _reset_codes.get(payload.email)
    if not entry:
        raise HTTPException(status_code=400, detail="No reset code requested for this email")
    code, expiry = entry
    if time.time() > expiry:
        del _reset_codes[payload.email]
        raise HTTPException(status_code=400, detail="Reset code has expired — request a new one")
    if payload.code != code:
        raise HTTPException(status_code=400, detail="Incorrect reset code")
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    del _reset_codes[payload.email]
    return {"ok": True}


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": create_token(user.id), "user_id": user.id, "email": user.email}
