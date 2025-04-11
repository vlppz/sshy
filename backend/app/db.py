from app.config import settings

TORTOISE_ORM = {
    "connections": {"default": settings.DB_URL},
    "apps": {
        "models": {
            "models": ["app.models", "aerich.models"],
            "default_connection": "default",
        },
    },
} 