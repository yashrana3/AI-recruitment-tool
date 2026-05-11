from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from urllib.parse import quote_plus

DB_USER = "admin"
DB_PASSWORD = quote_plus("Abc!123XYZ")  # Password with @ symbol (URL encoded)
DB_HOST = "64.227.166.146"
DB_PORT = 3306
DB_NAME = "hr_parser"  # Database name as shown in MySQL

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"+f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
