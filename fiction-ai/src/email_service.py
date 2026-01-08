from __future__ import annotations

import os
import resend
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
resend.api_key = RESEND_API_KEY

def send_verification_email(email: str, token: str, full_name: str):
    if not RESEND_API_KEY:
        print(f"RESEND_API_KEY not set. Mocking email send to {email} with token {token}")
        return

    # In production, use your actual domain
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    verification_link = f"{frontend_url}/verify-email?token={token}"

    params = {
        "from": "Fiction AI <onboarding@resend.dev>",
        "to": [email],
        "subject": "Verify your email - Fiction AI",
        "html": f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Welcome to Fiction AI, {full_name}!</h1>
            <p>Please verify your email address by clicking the link below:</p>
            <a href="{verification_link}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Verify Email</a>
            <p>If you didn't sign up for Fiction AI, you can safely ignore this email.</p>
        </div>
        """,
    }

    try:
        resend.Emails.send(params)
    except Exception as e:
        print(f"Error sending email: {e}")
