from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database.mysql import Base

class ApiCredits(Base):
    __tablename__ = "api_credits"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    api_name = Column(String(50), nullable=False, unique=True, index=True)  # mantiks, theirstack, coresignal
    credits_remaining = Column(Integer, nullable=True)
    credits_used = Column(Integer, nullable=True)
    credits_total = Column(Integer, nullable=True)
    last_updated = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)



