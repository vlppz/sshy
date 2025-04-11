from fastapi import APIRouter
from app.routes.auth import router as auth_router
from app.routes.servers import router as servers_router

router = APIRouter(prefix="/api", tags=["api"])

@router.get("/health")
async def health_check():
    return {"status": "healthy"}

router.include_router(auth_router)
router.include_router(servers_router)
