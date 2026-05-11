# models/mapping.py
from sqlalchemy import Column, Integer, String, Index
from database.mysql import Base

class Mapping(Base):
    __tablename__ = "mappings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    datapoint = Column(String(50), nullable=False, index=True)  # technologies, countries, industries, mantiks_countries
    raw = Column(String(255), nullable=False)  # The original value (keyword, country name, etc.)
    mapped = Column(String(255), nullable=False)  # The mapped value (slug, code, id, etc.)
    
    # Create composite index for faster lookups
    __table_args__ = (
        Index('idx_datapoint_raw', 'datapoint', 'raw'),
    )

