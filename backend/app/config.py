import os
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

class Settings:
    APP_ENV: str = os.getenv("APP_ENV", "development")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
    
    # Database settings
    DB_URL: str = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/postgres")
    
    # JWT settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your_secret_key_here")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 30
    
settings = Settings()