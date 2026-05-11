# backend/auth/router.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from database.mysql import get_db
from database.models.user import User, UserRole
from auth.password import hash_password, verify_password
from auth.jwt import create_access_token, create_reset_token, verify_token


# ========= Schemas =========
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class AdminCreateUser(BaseModel):
    email: EmailStr
    password: str
    role: str = "viewer"  # Default to viewer

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    newPassword: str
    confirmPassword: str

class AdminChangePasswordRequest(BaseModel):
    user_id: int
    new_password: str

class DeleteUserRequest(BaseModel):
    user_id: int

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ========= Security =========
security = HTTPBearer()


# ========= Dependencies =========
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    
    # Convert string user_id back to integer for database query
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    
    return user


def require_admin(current_user: User = Depends(get_current_user)):
    """Dependency to ensure user has admin role"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def require_viewer(current_user: User = Depends(get_current_user)):
    """Dependency to ensure user has at least viewer role (admin or viewer)"""
    # Both admin and viewer can access viewer endpoints
    if current_user.role not in [UserRole.ADMIN, UserRole.VIEWER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    return current_user


# ========= Router =========
router = APIRouter(prefix="/auth", tags=["Auth"])


# Signup endpoint removed - users can only be created by admins through user management
# @router.post("/signup", status_code=status.HTTP_201_CREATED)
# def signup(payload: UserCreate, db: Session = Depends(get_db)):
#     raise HTTPException(
#         status_code=status.HTTP_403_FORBIDDEN,
#         detail="Signup is disabled. Please contact an administrator."
#     )


@router.get("/me", status_code=status.HTTP_200_OK)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current authenticated user's information"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role.value,
        "is_active": current_user.is_active
    }


@router.get("/users", status_code=status.HTTP_200_OK)
def get_all_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all users - Admin only endpoint"""
    users = db.query(User).all()
    return [
        {
            "id": user.id,
            "email": user.email,
            "role": user.role.value,
            "is_active": user.is_active
        }
        for user in users
    ]


@router.post("/create-user", status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminCreateUser,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new user - Admin only endpoint"""
    # Validate role
    if payload.role not in ["admin", "viewer"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either 'admin' or 'viewer'"
        )
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Validate password length
    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )
    
    # Create user
    user_role = UserRole.ADMIN if payload.role == "admin" else UserRole.VIEWER
    user = User(
        email=payload.email,
        password=hash_password(payload.password),
        role=user_role,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {
        "message": "User created successfully",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role.value,
            "is_active": user.is_active
        }
    }


@router.delete("/user/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a user - Admin only endpoint"""
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account"
        )
    
    # Find the user to delete
    user_to_delete = db.query(User).filter(User.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Store user info for response before deletion
    deleted_user_info = {
        "id": user_to_delete.id,
        "email": user_to_delete.email,
        "role": user_to_delete.role.value
    }
    
    # Delete the user
    db.delete(user_to_delete)
    db.commit()
    
    return {
        "message": "User deleted successfully",
        "deleted_user": deleted_user_info
    }


@router.post("/signin", response_model=Token)
def signin(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # JWT 'sub' claim must be a string, not an integer
    access_token = create_access_token({"sub": str(user.id)})

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password - requires authentication"""
    # Verify old password
    if not verify_password(payload.old_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Check if new password is different from old password
    if payload.old_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password"
        )
    
    # Hash and update the new password
    current_user.password = hash_password(payload.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.post("/admin/change-password", status_code=status.HTTP_200_OK)
def admin_change_password(
    payload: AdminChangePasswordRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin endpoint to change any user's password"""
    # Find the target user
    target_user = db.query(User).filter(User.id == payload.user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate password length
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )
    
    # Hash and update the new password
    target_user.password = hash_password(payload.new_password)
    db.commit()
    
    return {
        "message": "Password changed successfully",
        "user": {
            "id": target_user.id,
            "email": target_user.email
        }
    }


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request password reset - generates reset token"""
    # Find user by email
    user = db.query(User).filter(User.email == payload.email).first()
    
    # Always return success message (don't reveal if email exists)
    # In production, you should send the reset token via email
    if user:
        # Generate reset token (sub must be string)
        reset_token = create_reset_token({"sub": str(user.id), "email": user.email})
        
        # In production, send this token via email to the user
        # For now, we return it (you should remove this in production!)
        return {
            "message": "If the email exists, a password reset token has been generated",
            "reset_token": reset_token  # Remove this in production - send via email instead
        }
    else:
        # Don't reveal if email exists (security best practice)
        return {
            "message": "If the email exists, a password reset token has been generated"
        }


@router.post("/debug-token", status_code=status.HTTP_200_OK)
def debug_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Debug endpoint to test token verification"""
    from auth.jwt import SECRET_KEY, verify_token
    from jose import jwt as jose_jwt
    import json
    
    token = credentials.credentials
    payload = verify_token(token)
    
    # Try to decode without verification to see the raw payload
    try:
        unverified = jose_jwt.decode(token, key="", options={"verify_signature": False})
    except Exception as e:
        unverified = {"error": str(e), "error_type": type(e).__name__}
    
    # Try to decode with the secret key to see the actual error
    verification_error = None
    try:
        test_payload = jose_jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except Exception as e:
        verification_error = {
            "error": str(e),
            "error_type": type(e).__name__
        }
    
    return {
        "token_received": token[:50] + "..." if len(token) > 50 else token,
        "token_length": len(token),
        "verification_result": payload,
        "unverified_payload": unverified,
        "verification_error": verification_error,
        "secret_key": SECRET_KEY[:20] + "..." if len(SECRET_KEY) > 20 else SECRET_KEY,
        "secret_key_length": len(SECRET_KEY)
    }


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using reset token (for forgot password flow)"""
    # Verify reset token
    payload_data = verify_token(payload.token)
    
    if payload_data is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Check if token is a reset token
    if payload_data.get("type") != "reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token type"
        )
    
    # Get user ID from token (sub is stored as string)
    user_id_str = payload_data.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token payload"
        )
    
    # Convert string user_id back to integer for database query
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID in token"
        )
    
    # Find user
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate new password matches confirm password
    if payload.newPassword != payload.confirmPassword:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirm password do not match"
        )
    
    # Hash and update the new password
    user.password = hash_password(payload.newPassword)
    db.commit()
    
    return {"message": "Password reset successfully"}