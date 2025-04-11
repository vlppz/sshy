from tortoise import fields, models
from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import ClassVar


class User(models.Model):
    id = fields.IntField(pk=True)
    email = fields.CharField(max_length=255, unique=True)
    password_hash = fields.CharField(max_length=255)
    is_active = fields.BooleanField(default=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    modified_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "users"

    def __str__(self):
        return self.email


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    is_active: bool
    created_at: datetime
    modified_at: datetime
    
    @classmethod
    async def from_tortoise_orm(cls, user: User):
        return cls(
            id=user.id,
            email=user.email,
            is_active=user.is_active,
            created_at=user.created_at,
            modified_at=user.modified_at
        )
