from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from tortoise.contrib.fastapi import register_tortoise

from app.routes.api import router as api_router
from app.config import settings

app = FastAPI(
    title="SSHY API",
    description="API for SSHY application",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to SSHY API"}

app.include_router(api_router)

# Register Tortoise ORM
register_tortoise(
    app,
    db_url=settings.DB_URL,
    modules={"models": ["app.models"]},
    generate_schemas=True,
    add_exception_handlers=True,
)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
