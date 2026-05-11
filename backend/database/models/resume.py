from sqlalchemy import Column, String, Text, JSON, TIMESTAMP, Integer
from sqlalchemy.sql import func
from database.mysql import Base

class Resume(Base):
    __tablename__ = "resumes"

    # Using email as primary key (assuming emails are unique per resume)
    # If email is not unique, we'll need to keep id or use composite key
    # For now, keeping id internally but not exposing it
    id = Column(String(100), primary_key=True)
    linkedin_url = Column(Text, nullable=True)
    full_name = Column(String(255), nullable=True)
    headline = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    location_country = Column(String(100), nullable=True)
    location_full = Column(Text, nullable=True)
    skills = Column(JSON, nullable=True)  # Store skills as JSON array
    email = Column(String(255), nullable=True, unique=True, index=True)
    title = Column(String(255), nullable=True)
    experience = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
