from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from database.mysql import Base
from datetime import datetime

class Scheduler(Base):
    __tablename__ = "scheduler"

    #id = Column(Integer, primary_key=True, index=True)
    scheduler_id = Column(Integer,primary_key=True, unique=True, index=True)
    api_name = Column(String(50))
    payload_json = Column(Text)

    interval_type = Column(String(20))        # ✅ ADD
    interval_seconds = Column(Integer)        # ✅ ADD
    next_run = Column(DateTime)                # ✅ ADD

    is_active = Column(Boolean, default=True)
    last_run = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Store commonly accessed fields separately for easier querying/display
    job_title = Column(Text, nullable=True)  # Store job titles/keywords
    skills = Column(Text, nullable=True)  # Store skills/keywords
    location = Column(String(255), nullable=True)  # Store location
    limit_value = Column(Integer, nullable=True)  # Store limit
    
    # Relationship to execution history
    runs = relationship("SchedulerRun", back_populates="scheduler", cascade="all, delete-orphan")


class SchedulerRun(Base):
    """Track each execution of a scheduler with job counts and status"""
    __tablename__ = "scheduler_runs"
    
    run_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    scheduler_id = Column(Integer, ForeignKey("scheduler.scheduler_id"), nullable=False, index=True)
    executed_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    jobs_fetched = Column(Integer, default=0)
    has_error = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    execution_time_seconds = Column(Integer, nullable=True)  # How long the execution took
    
    # Relationship back to scheduler
    scheduler = relationship("Scheduler", back_populates="runs")
