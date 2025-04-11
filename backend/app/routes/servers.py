from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from app.models.server import Server, ServerCreate, ServerUpdate, ServerOut
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter(prefix="/servers", tags=["servers"])


@router.post("", response_model=ServerOut)
async def create_server(
    server_data: ServerCreate,
    current_user: User = Depends(get_current_user)
):
    server = await Server.create(
        **server_data.model_dump(),
        user=current_user
    )
    return await ServerOut.from_tortoise_orm(server)


@router.get("", response_model=List[ServerOut])
async def list_servers(current_user: User = Depends(get_current_user)):
    servers = await Server.filter(user=current_user)
    return [await ServerOut.from_tortoise_orm(server) for server in servers]


@router.get("/{server_id}", response_model=ServerOut)
async def get_server(
    server_id: int,
    current_user: User = Depends(get_current_user)
):
    server = await Server.get_or_none(id=server_id, user=current_user)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    return await ServerOut.from_tortoise_orm(server)


@router.put("/{server_id}", response_model=ServerOut)
async def update_server(
    server_id: int,
    server_data: ServerUpdate,
    current_user: User = Depends(get_current_user)
):
    server = await Server.get_or_none(id=server_id, user=current_user)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    update_data = server_data.model_dump(exclude_unset=True)
    if update_data:
        await server.update_from_dict(update_data).save()
    
    return await ServerOut.from_tortoise_orm(server)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: int,
    current_user: User = Depends(get_current_user)
):
    server = await Server.get_or_none(id=server_id, user=current_user)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    await server.delete() 