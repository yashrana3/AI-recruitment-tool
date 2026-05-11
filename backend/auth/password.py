# auth/password.py
import bcrypt

def hash_password(password: str) -> str:
    """Hash a password using bcrypt. Automatically truncates to 72 bytes if needed."""
    if not password:
        raise ValueError("Password cannot be empty")
    
    # Convert to bytes and truncate to 72 bytes if necessary (bcrypt limit)
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    # Hash the password
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a hash. Applies same truncation as hashing."""
    if not password or not hashed:
        return False
    
    # Apply same truncation as in hash_password
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    # Verify the password
    hashed_bytes = hashed.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)
