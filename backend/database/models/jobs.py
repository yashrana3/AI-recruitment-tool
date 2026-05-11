from sqlalchemy import Column, String, Text, DateTime, Index
from database.mysql import Base

class Job(Base):
    __tablename__ = "jobs"

    
    id = Column(String(100), primary_key=True, index=True)
    created_at = Column(DateTime, index=True)  # Add index for faster sorting
    location = Column(String(255))
    country = Column(String(100))
    title = Column(String(255))
    description = Column(Text)
    seniority = Column(String(100))
    job_url = Column(Text)
    company_name = Column(String(255))
    company_website = Column(String(255))
    company_industry = Column(String(255))
    company_keywords = Column(Text)
    email = Column(String(255))
    scheduler_id = Column(String(100), nullable=True, index=True)  # Add scheduler_id field
    credits_remaining = Column(String(50), nullable=True)  # Credits remaining from Mantiks API
    
    # Create composite index for scheduler_id and created_at for efficient queries
    __table_args__ = (
        Index('idx_scheduler_created', 'scheduler_id', 'created_at'),
    )
