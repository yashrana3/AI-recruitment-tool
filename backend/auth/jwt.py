# auth/jwt.py
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

SECRET_KEY = "CHANGE_THIS_SECRET"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440
RESET_TOKEN_EXPIRE_MINUTES = 30  # Reset tokens expire in 30 minutes

def create_access_token(data: dict):
    to_encode = data.copy()
    # Use timezone-aware datetime and convert to Unix timestamp
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # Convert to Unix timestamp (seconds since epoch) - jose expects numeric timestamp
    to_encode.update({"exp": int(expire.timestamp())})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_reset_token(data: dict):
    """Create a password reset token with shorter expiry"""
    to_encode = data.copy()
    # Use timezone-aware datetime and convert to Unix timestamp
    expire = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    # Convert to Unix timestamp (seconds since epoch) - jose expects numeric timestamp
    to_encode.update({"exp": int(expire.timestamp()), "type": "reset"})  # Add type to identify reset tokens
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> dict:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        # Log the specific error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"JWT Verification Error: {type(e).__name__}: {str(e)}")
        print(f"JWT Verification Error: {type(e).__name__}: {str(e)}")
        return None