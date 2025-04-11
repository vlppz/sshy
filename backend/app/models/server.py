from tortoise import fields, models
from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional


class Server(models.Model):
    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=255)
    username = fields.CharField(max_length=255)
    address = fields.CharField(max_length=255)
    encrypted_auth_data = fields.CharField(max_length=10000)
    user = fields.ForeignKeyField('models.User', related_name='servers')
    created_at = fields.DatetimeField(auto_now_add=True)
    modified_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "servers"

    def __str__(self):
        return self.name


class ServerCreate(BaseModel):
    name: str
    username: str
    address: str
    encrypted_auth_data: str


class ServerUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    address: Optional[str] = None
    encrypted_auth_data: Optional[str] = None


class ServerOut(BaseModel):
    id: int
    name: str
    username: str
    address: str
    encrypted_auth_data: str
    user_id: int
    created_at: datetime
    modified_at: datetime
    
    @classmethod
    async def from_tortoise_orm(cls, server: Server):
        return cls(
            id=server.id,
            name=server.name,
            username=server.username,
            address=server.address,
            encrypted_auth_data=server.encrypted_auth_data,
            user_id=server.user_id,
            created_at=server.created_at,
            modified_at=server.modified_at
        )
