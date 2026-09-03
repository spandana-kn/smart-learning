from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "student"

class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    avatar_id: str
    level: int
    xp_total: int
    xp_current: int
    xp_to_next: int
    streak_days: int

    model_config = {"from_attributes": True}

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
