
from sqlalchemy import Column, String, DECIMAL
from database.mysql import Base

class Matched(Base):
    __tablename__ = "matched"

    job_id = Column(String(100), primary_key=True)
    resume_id = Column(String(100), primary_key=True)
    score = Column(DECIMAL(5, 2))
