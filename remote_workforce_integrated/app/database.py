from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import DATABASE_URL

# SQLite needs check_same_thread=False
# PostgreSQL (Supabase) needs sslmode for secure connection
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine_url = DATABASE_URL
else:
    connect_args = {}
    # Supabase uses postgresql:// but SQLAlchemy needs postgresql+psycopg2://
    engine_url = DATABASE_URL
    if engine_url.startswith("postgres://"):
        engine_url = engine_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    engine_url,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
