# data.py
import csv
import os
from pathlib import Path
from typing import List, Dict, Any , Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import json
from sqlalchemy import cast, JSON as JSONType
from sqlalchemy.dialects.mysql import JSON

# In the query, explicitly cast skills to ensure proper deserialization
# This might be needed in the read_resumes_for_matching function
# Database imports
from helpers import skill_classifier
from database.mysql import SessionLocal
from database.models.jobs import Job
from database.models.resume import Resume
from database.models.matched import Matched
from database.models.scheduler import Scheduler, SchedulerRun
from database.models.mapping import Mapping

# Get the project root directory (assuming this file is at backend/database/models/data.py)
# Go up 3 levels: models -> database -> backend -> project root
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
DATA_DIR = str(BASE_DIR / "data") + "/"
# Constants for CSV paths and fields (still used for mappings and schedulers)
file_mapping = {"technologies": {
                     "filename": "keywords.csv",
                     "raw": "keywords",
                     "mapped": "slug"},
                "countries": {
                     "filename": "countries.csv",
                     "raw": "country",
                     "mapped": "code"},
                "industries": {
                     "filename": "industries.csv",
                     "raw": "industry",
                     "mapped": "industry_id"},
                "mantiks_countries": {
                    "filename": "mantiks_countries.csv",
                    "raw": "country",
                    "mapped": "location_id"
                }}

CSV_PATH_SCHEDULERS = DATA_DIR+ "schedulers.csv"
SCHEDULER_FIELDS = [
    "scheduler_id", "location", "job_title", "skills", "limit",
    "is_active", "last_run"
]


# Database helper functions
def get_db() -> Session:
    """Get database session"""
    db = SessionLocal()
    try:
        return db
    finally:
        pass  # Session will be closed by caller


def read_jobs_from_csv() -> List[Dict[str, Any]]:
    """Read jobs from database.
    Returns jobs ordered by scheduler_id (numeric first descending, then text).
    """
    db = SessionLocal()
    try:
        # Fetch all jobs without ordering - we'll sort in Python for custom logic
        jobs = db.query(Job).all()
        
        result = []
        for job in jobs:
            # Parse company_keywords as array
            keywords_list = job.company_keywords.split(",") if job.company_keywords else []
            job_dict = {
                "id": job.id,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "location": job.location,
                "country": job.country,
                "title": job.title,
                "description": job.description,
                "seniority": job.seniority,
                "job_url": job.job_url,
                "company_name": job.company_name,
                "company_website": job.company_website,
                "company_industry": job.company_industry,
                "company_keywords": keywords_list,
                "skills": keywords_list,  # Also return as skills for frontend
                "email": job.email,
                "scheduler_id": job.scheduler_id  # Include scheduler_id
            }
            result.append(job_dict)
        
        # Sort: numeric scheduler_ids first (descending), then text scheduler_ids
        def sort_key(job_dict):
            scheduler_id = job_dict.get("scheduler_id")
            if scheduler_id is None:
                return (1, "")  # None values go to end
            
            # Try to convert to integer
            try:
                numeric_id = int(scheduler_id)
                return (0, -numeric_id)  # 0 = numeric, negative for descending order
            except (ValueError, TypeError):
                return (1, scheduler_id)  # 1 = text, sort alphabetically
        
        result.sort(key=sort_key)
        return result
    finally:
        db.close()


def save_jobs_to_csv(jobs: List[Dict[str, Any]], scheduler_id: Optional[str] = None) -> int:
    """Save jobs to database (keeping old function name for compatibility).
    Skips rows whose 'id' already exists.

    Args:
        jobs: List of job dictionaries
        scheduler_id: Optional scheduler ID to associate with these jobs
        
    Returns:
        Number of jobs actually saved (excluding duplicates)
    """
    if not jobs:
        return 0

    db = SessionLocal()
    saved_count = 0
    try:
        # Collect existing IDs
        existing_ids = {job.id for job in db.query(Job.id).all()}

        for job_data in jobs:
            job_id = str(job_data.get("id"))

            # Skip if already exists
            if job_id in existing_ids:
                continue

            # Convert company_keywords list to comma-separated string
            # Check for skills or Skills from APIs if company_keywords is missing
            keywords = job_data.get("company_keywords") or job_data.get("skills") or job_data.get("Skills") or []
            
            if isinstance(keywords, list):
                keywords_str = ",".join(str(k) for k in keywords if k)
            else:
                keywords_str = str(keywords) if keywords else None

            # Convert created_at if it's a string
            created_at = job_data.get("created_at")
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                except:
                    created_at = None
            elif not isinstance(created_at, datetime) and created_at is not None:
                created_at = None

            # Use scheduler_id from job_data if provided, otherwise use parameter
            scheduler_id_to_save = job_data.get("scheduler_id") or scheduler_id
            print(f"DEBUG: Saving job {job_id} with scheduler_id '{scheduler_id_to_save}'")

            # Extract credits_remaining from job_data (Mantiks API provides this)
            credits_remaining = job_data.get("credits_remaining") or job_data.get("credit_remaining")
            if credits_remaining is not None:
                credits_remaining = str(credits_remaining)

            job = Job(
                id=job_id,
                created_at=created_at,
                location=job_data.get("location"),
                country=job_data.get("country"),
                title=job_data.get("title"),
                description=job_data.get("description"),
                seniority=job_data.get("seniority"),
                job_url=job_data.get("job_url"),
                company_name=job_data.get("company_name"),
                company_website=job_data.get("company_website"),
                company_industry=job_data.get("company_industry"),
                company_keywords=keywords_str,
                email=job_data.get("email"),
                scheduler_id=scheduler_id_to_save,  # Add scheduler_id
                credits_remaining=credits_remaining  # Add credits_remaining from Mantiks
            )

            db.add(job)
            existing_ids.add(job_id)
            saved_count += 1

        db.commit()
        return saved_count
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def save_resumes_to_csv(rows: List[Dict[str, Any]]):
    """Save resumes to database (keeping old function name for compatibility).
    Skips rows whose 'id' already exists.
    """
    if not rows:
        return

    db = SessionLocal()
    try:
        # Collect existing IDs
        existing_ids = {resume.id for resume in db.query(Resume.id).all()}

        for row_data in rows:
            row_id = str(row_data.get("id"))

            # Skip if already exists
            if row_id in existing_ids:
                continue

            # Extract skills - ensure it's a list
            skills = row_data.get("skills", [])
            if isinstance(skills, str):
                # If it's a comma-separated string, convert to list
                skills = [s.strip() for s in skills.split(",") if s.strip()]
            elif not isinstance(skills, list):
                skills = []

            # Extract experience - convert to int if possible
            experience = row_data.get("experience")
            if experience is not None:
                try:
                    experience = int(experience)
                except (ValueError, TypeError):
                    experience = None

            # Store data in individual columns
            resume = Resume(
                id=row_id,
                linkedin_url=row_data.get("linkedin_url"),
                full_name=row_data.get("full_name"),
                headline=row_data.get("headline"),
                summary=row_data.get("summary"),
                location_country=row_data.get("location_country"),
                location_full=row_data.get("location_full"),
                skills=skills,  # Store as JSON array
                email=row_data.get("email"),
                title=row_data.get("title"),
                experience=experience
            )

            db.add(resume)
            existing_ids.add(row_id)

        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def read_resumes_from_csv(
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
    search_query: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Read resumes from database with optional pagination and search filtering.
    
    Args:
        limit: Maximum number of resumes to return (None = all)
        offset: Number of resumes to skip (for pagination)
        search_query: Optional search string to filter resumes (searches across multiple fields)
    
    Returns:
        List of resume dictionaries
    """
    db = SessionLocal()
    try:
        # Start with base query
        query = db.query(Resume)
        
        # Apply search filter if provided (database-level filtering)
        if search_query:
            search_lower = search_query.lower()
            # Use OR conditions to search across multiple fields
            from sqlalchemy import or_
            query = query.filter(
                or_(
                    Resume.full_name.ilike(f"%{search_lower}%"),
                    Resume.email.ilike(f"%{search_lower}%"),
                    Resume.title.ilike(f"%{search_lower}%"),
                    Resume.headline.ilike(f"%{search_lower}%"),
                    Resume.location_full.ilike(f"%{search_lower}%"),
                    Resume.location_country.ilike(f"%{search_lower}%"),
                    Resume.summary.ilike(f"%{search_lower}%")
                )
            )
        
        # Apply pagination at database level
        if limit is not None:
            query = query.limit(limit).offset(offset)
        
        # Execute query and convert to dicts
        resumes = query.all()
        result = []
        for resume in resumes:
            # Reconstruct dictionary from individual columns
            # Note: id is kept for internal use (matching, foreign keys) but can be hidden in UI
            skills = resume.skills
            if skills is None:
                skills = []
            elif isinstance(skills, str):
                # If skills is a JSON string, parse it
                if skills.strip().startswith('['):
                    try:
                        skills = json.loads(skills)
                    except:
                        skills = []
                else:
                    # If it's a comma-separated string, split it
                    skills = [s.strip() for s in skills.split(',') if s.strip()]
            elif not isinstance(skills, list):
                skills = []
            
            resume_dict = {
                "id": resume.id,  # Keep for internal use (matching, foreign keys)
                "linkedin_url": resume.linkedin_url,
                "full_name": resume.full_name,
                "headline": resume.headline,
                "summary": resume.summary,
                "location_country": resume.location_country,
                "location_full": resume.location_full,
                "skills": skills,  # Return as list
                "email": resume.email,
                "title": resume.title,
                "experience": resume.experience
            }
            if resume.created_at:
                resume_dict["created_at"] = resume.created_at.isoformat()
            result.append(resume_dict)
        return result
    finally:
        db.close()


def count_resumes_from_csv(search_query: Optional[str] = None) -> int:
    """Count total resumes in database with optional search filter.
    
    Args:
        search_query: Optional search string to filter resumes
    
    Returns:
        Total count of resumes matching the filter
    """
    db = SessionLocal()
    try:
        query = db.query(Resume)
        
        # Apply search filter if provided
        if search_query:
            search_lower = search_query.lower()
            from sqlalchemy import or_
            query = query.filter(
                or_(
                    Resume.full_name.ilike(f"%{search_lower}%"),
                    Resume.email.ilike(f"%{search_lower}%"),
                    Resume.title.ilike(f"%{search_lower}%"),
                    Resume.headline.ilike(f"%{search_lower}%"),
                    Resume.location_full.ilike(f"%{search_lower}%"),
                    Resume.location_country.ilike(f"%{search_lower}%"),
                    Resume.summary.ilike(f"%{search_lower}%")
                )
            )
        
        return query.count()
    finally:
        db.close()


def read_resumes_for_matching(
    location_country: Optional[str] = None,
    location_city: Optional[str] = None,
    experience_min: Optional[int] = None,
    experience_max: Optional[int] = None,
    job_title_keywords: Optional[List[str]] = None,
    max_results: Optional[int] = None
) -> List[Dict[str, Any]]:
    """Read resumes from database optimized for matching with pre-filtering.
    Only loads columns needed for matching (excludes summary to save memory).
    Applies database-level filtering to reduce dataset before scoring.
    
    Args:
        location_country: Filter by country (optional)
        location_city: Filter by city (searches in location_full) (optional)
        experience_min: Minimum years of experience (optional)
        experience_max: Maximum years of experience (optional)
        job_title_keywords: Filter by job title keywords (optional)
        max_results: Maximum number of results to return (optional, for further limiting)
    
    Returns:
        List of resume dictionaries with matching-relevant fields only
    """
    db = SessionLocal()
    try:
        from sqlalchemy import or_, and_, func, text
        from sqlalchemy.orm import Query
        
        # Start with base query selecting only needed columns
        query: Query = db.query(
            Resume.id,
            Resume.linkedin_url,
            Resume.full_name,
            Resume.headline,
            Resume.location_country,
            Resume.location_full,
            Resume.skills,
            Resume.email,
            Resume.title,
            Resume.experience
        )
        
        # Apply location filters
        if location_country and location_country.lower() != "none":
            query = query.filter(
                or_(
                    Resume.location_country.ilike(f"%{location_country}%"),
                    Resume.location_full.ilike(f"%{location_country}%")
                )
            )
        
        if location_city and location_city.lower() != "none":
            # Extract city name (first word) for matching
            city_name = location_city.split()[0] if location_city else None
            if city_name:
                query = query.filter(
                    Resume.location_full.ilike(f"%{city_name}%")
                )
        
        # Apply experience filters
        if experience_min is not None:
            query = query.filter(Resume.experience >= experience_min)
        if experience_max is not None:
            query = query.filter(Resume.experience <= experience_max)
        
        # Apply job title filter
        if job_title_keywords:
            title_filters = []
            for keyword in job_title_keywords:
                if keyword and keyword.strip():
                    keyword_lower = keyword.strip().lower()
                    title_filters.append(
                        or_(
                            Resume.title.ilike(f"%{keyword_lower}%"),
                            Resume.headline.ilike(f"%{keyword_lower}%")
                        )
                    )
            if title_filters:
                query = query.filter(or_(*title_filters))
        
        # Apply skills filter using MySQL JSON functions
        # Note: Skills filtering is complex with JSON arrays, so we'll do a two-phase approach:
        # 1. Filter by location/experience first (fast DB filters)
        # 2. Then filter by skills in Python (more flexible matching)
        # This still significantly reduces the dataset before scoring
        
        # Apply max results limit if specified
        if max_results:
            query = query.limit(max_results)
        
        # Execute query
        resumes = query.all()
        
        result = []
        # Around line 464-479, update the skills parsing logic:
        for resume in resumes:
            skills = resume.skills
            print(f"DEBUG: skills type: {type(skills)}, value: {skills}")  # Add this line
            # Ensure skills is always a list
            if skills is None:
                skills = []
            elif isinstance(skills, str):
                # If skills is a JSON string, parse it
                skills_str = skills.strip()
                if skills_str.startswith('[') or skills_str.startswith('{'):
                    try:
                        skills = json.loads(skills)
                        # Ensure it's a list, not a dict
                        if isinstance(skills, dict):
                            skills = list(skills.values()) if skills else []
                    except (json.JSONDecodeError, ValueError):
                        # If JSON parsing fails, try comma-separated
                        skills = [s.strip() for s in skills.split(',') if s.strip()]
                else:
                    # If it's a comma-separated string, split it
                    skills = [s.strip() for s in skills.split(',') if s.strip()]
            elif isinstance(skills, list):
                # Already a list, ensure all items are strings
                skills = [str(s).strip() for s in skills if s and str(s).strip()]
            else:
                # If it's not a list or string, convert to empty list
                skills = []
            
            # Reconstruct dictionary from selected columns only
            resume_dict = {
                "id": resume.id,
                "linkedin_url": resume.linkedin_url,
                "full_name": resume.full_name,
                "headline": resume.headline,
                "location_country": resume.location_country,
                "location_full": resume.location_full,
                "skills": skills,
                "email": resume.email,
                "title": resume.title,
                "experience": resume.experience
            }
            result.append(resume_dict)
        return result
    finally:
        db.close()


def read_matched_from_csv() -> List[Dict[str, Any]]:
    """Read matched data from database with joined job and resume details"""
    db = SessionLocal()
    try:
        # Use LEFT JOIN to handle cases where job or resume might not exist
        matched_records = db.query(
            Matched,
            Job,
            Resume
        ).outerjoin(
            Job, Matched.job_id == Job.id
        ).outerjoin(
            Resume, Matched.resume_id == Resume.id
        ).all()
        
        result = []
        for match, job, resume in matched_records:
            # Build job details (excluding id from display)
            job_details = None
            if job:
                job_details = {
                    "title": job.title,
                    "company_name": job.company_name,
                    "location": job.location,
                    "country": job.country,
                    "seniority": job.seniority,
                    "job_url": job.job_url,
                    "description": job.description[:200] + "..." if job.description and len(job.description) > 200 else job.description,
                }
            
            # Build resume details (excluding id from display)
            resume_details = None
            if resume:
                resume_details = {
                    "full_name": resume.full_name,
                    "email": resume.email,
                    "title": resume.title,
                    "location_full": resume.location_full,
                    "headline": resume.headline,
                    "skills": resume.skills if resume.skills else [],
                    "experience": resume.experience,
                    "linkedin_url": resume.linkedin_url,
                }
            
            result.append({
                "job_id": match.job_id,  # Keep for reference/internal use
                "resume_id": match.resume_id,  # Keep for reference/internal use
                "score": str(match.score) if match.score is not None else None,
                "job": job_details,
                "resume": resume_details
            })
        return result
    except Exception as e:
        print(f"Error reading matched data: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to basic data if join fails
        matched_records = db.query(Matched).all()
        result = []
        for match in matched_records:
            result.append({
                "job_id": match.job_id,
                "resume_id": match.resume_id,
                "score": str(match.score) if match.score is not None else None,
                "job": None,
                "resume": None
            })
        return result
    finally:
        db.close()


def save_matched_to_csv(matched: List[Dict[str, Any]]):
    """Save matched data to database (keeping old function name for compatibility)"""
    if not matched:
        return

    db = SessionLocal()
    try:
        for entry in matched:
            # Check if this match already exists
            existing = db.query(Matched).filter(
                Matched.job_id == str(entry.get("job_id")),
                Matched.resume_id == str(entry.get("resume_id"))
            ).first()

            if existing:
                # Update score if exists
                existing.score = float(entry.get("score", 0))
            else:
                # Create new match
                match_record = Matched(
                    job_id=str(entry.get("job_id")),
                    resume_id=str(entry.get("resume_id")),
                    score=float(entry.get("score", 0))
                )
                db.add(match_record)

        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def load_mappings(datapoint: str) -> List[Dict[str, str]]:
    # Check if datapoint exists in mapping
    if datapoint not in file_mapping:
        print(f"ERROR: Datapoint '{datapoint}' not found in file_mapping. Available: {list(file_mapping.keys())}")
        return []

    CSV_PATH = DATA_DIR + "mapping/" + file_mapping[datapoint]['filename']
    final_data = []

    # Convert to absolute path for better debugging
    abs_path = os.path.abspath(CSV_PATH)
    print(f"DEBUG: Loading mappings from: {abs_path}")
    print(f"DEBUG: DATA_DIR = {DATA_DIR}")
    print(f"DEBUG: Looking for file: {file_mapping[datapoint]['filename']}")

    if not os.path.exists(CSV_PATH):
        print(f"ERROR: File not found: {abs_path}")
        return final_data

    try:
        with open(CSV_PATH, newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)

            # Get column names from CSV
            fieldnames = reader.fieldnames
            print(f"DEBUG load_mappings: CSV columns found: {fieldnames}")

            if not fieldnames:
                print(f"ERROR: CSV file has no columns: {abs_path}")
                return final_data

            # Check if required columns exist
            raw_col = file_mapping[datapoint]["raw"]
            mapped_col = file_mapping[datapoint]["mapped"]

            if raw_col not in fieldnames:
                print(f"ERROR: Required column '{raw_col}' not found in CSV. Available columns: {fieldnames}")
                return final_data

            if mapped_col not in fieldnames:
                print(f"ERROR: Required column '{mapped_col}' not found in CSV. Available columns: {fieldnames}")
                return final_data

            row_count = 0
            empty_rows = 0
            for row in reader:
                row_count += 1
                raw_value = row.get(raw_col, "").strip()
                mapped_value = row.get(mapped_col, "").strip()

                # Only add non-empty rows
                if raw_value or mapped_value:
                    final_data.append({
                        "raw": raw_value,
                        "mapped": mapped_value,
                    })
                else:
                    empty_rows += 1

            print(f"DEBUG load_mappings: Loaded {len(final_data)} mappings from {row_count} total rows (skipped {empty_rows} empty rows)")

            # Check if columns exist but no data was loaded
            if row_count > 0 and len(final_data) == 0:
                print(f"WARNING: File has {row_count} rows but no valid data. All rows might be empty.")
                # Show sample row for debugging
                csvfile.seek(0)
                reader = csv.DictReader(csvfile)
                first_row = next(reader, None)
                if first_row:
                    print(f"DEBUG load_mappings: Sample row: {first_row}")

    except Exception as e:
        print(f"ERROR: Failed to read CSV file {CSV_PATH}: {e}")
        import traceback
        traceback.print_exc()
        return final_data

    return final_data

def populate_mappings_from_csv():
    """
    Populate mappings table from CSV files.
    This function reads all CSV files and inserts/updates the database.
    It's safe to run multiple times - it will update existing records.
    """
    db = SessionLocal()
    try:
        print("=" * 60)
        print("Starting to populate mappings from CSV files...")
        print(f"DATA_DIR: {DATA_DIR}")
        print("=" * 60)

        total_inserted = 0
        total_updated = 0
        total_skipped = 0

        for datapoint, config in file_mapping.items():
            CSV_PATH = DATA_DIR + "mapping/" + config['filename']
            abs_path = os.path.abspath(CSV_PATH)

            print(f"\n[{datapoint}] Processing from: {abs_path}")

            if not os.path.exists(CSV_PATH):
                print(f"  ✗ ERROR: CSV file not found: {abs_path}")
                continue

            print(f"  ✓ File exists")

            try:
                with open(CSV_PATH, newline="", encoding="utf-8") as csvfile:
                    reader = csv.DictReader(csvfile)

                    if not reader.fieldnames:
                        print(f"  ✗ ERROR: CSV file has no columns")
                        continue

                    print(f"  ✓ CSV columns: {reader.fieldnames}")

                    raw_col = config["raw"]
                    mapped_col = config["mapped"]

                    if raw_col not in reader.fieldnames:
                        print(f"  ✗ ERROR: Required column '{raw_col}' not found. Available: {reader.fieldnames}")
                        continue

                    if mapped_col not in reader.fieldnames:
                        print(f"  ✗ ERROR: Required column '{mapped_col}' not found. Available: {reader.fieldnames}")
                        continue

                    inserted_count = 0
                    updated_count = 0
                    skipped_count = 0
                    error_count = 0

                    for row_num, row in enumerate(reader, start=2):  # Start at 2 (row 1 is header)
                        try:
                            raw_value = row.get(raw_col, "").strip()
                            mapped_value = row.get(mapped_col, "").strip()

                            # Skip empty rows
                            if not raw_value and not mapped_value:
                                skipped_count += 1
                                continue

                            # Check if mapping already exists
                            existing = db.query(Mapping).filter(
                                Mapping.datapoint == datapoint,
                                Mapping.raw == raw_value
                            ).first()

                            if existing:
                                # Update if mapped value changed
                                if existing.mapped != mapped_value:
                                    existing.mapped = mapped_value
                                    updated_count += 1
                            else:
                                # Insert new mapping
                                new_mapping = Mapping(
                                    datapoint=datapoint,
                                    raw=raw_value,
                                    mapped=mapped_value
                                )
                                db.add(new_mapping)
                                inserted_count += 1

                            # Commit in batches of 1000 for better performance
                            if (inserted_count + updated_count) % 1000 == 0:
                                db.commit()
                                print(f"  ... Processed {row_num} rows, committed batch...")

                        except Exception as row_error:
                            error_count += 1
                            if error_count <= 5:  # Only print first 5 errors
                                print(f"  ⚠ ERROR at row {row_num}: {row_error}")
                            continue

                    # Final commit for remaining records
                    db.commit()

                    total_inserted += inserted_count
                    total_updated += updated_count
                    total_skipped += skipped_count

                    print(f"  ✓ {datapoint}: Inserted {inserted_count}, Updated {updated_count}, Skipped {skipped_count}")
                    if error_count > 0:
                        print(f"  ⚠ {datapoint}: {error_count} rows had errors")

            except Exception as e:
                print(f"  ✗ ERROR: Failed to process {datapoint} from {CSV_PATH}")
                print(f"     Error: {str(e)}")
                import traceback
                traceback.print_exc()
                db.rollback()
                continue

        print("\n" + "=" * 60)
        print(f"Finished populating mappings from CSV files.")
        print(f"Total: Inserted {total_inserted}, Updated {total_updated}, Skipped {total_skipped}")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ CRITICAL ERROR in populate_mappings_from_csv: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise  # Re-raise to see the error
    finally:
        db.close()

def load_mappings(datapoint: str) -> List[Dict[str, str]]:
    """
    Load mappings from database based on datapoint type.

    Args:
        datapoint: Type of mapping to load (technologies, countries, industries, mantiks_countries)

    Returns:
        List of dictionaries with 'raw' and 'mapped' keys
    """
    # Check if datapoint exists in mapping
    if datapoint not in file_mapping:
        print(f"ERROR: Datapoint '{datapoint}' not found in file_mapping. Available: {list(file_mapping.keys())}")
        return []

    db = SessionLocal()
    try:
        # Query mappings from database
        mappings = db.query(Mapping).filter(
            Mapping.datapoint == datapoint
        ).all()

        if not mappings:
            print(f"WARNING: No mappings found in database for datapoint '{datapoint}'. Database might be empty.")
            print(f"  Attempting to populate from CSV files...")
            db.close()
            # Try to populate from CSV and retry
            populate_mappings_from_csv()
            db = SessionLocal()
            mappings = db.query(Mapping).filter(
                Mapping.datapoint == datapoint
            ).all()

        # Convert to list of dicts
        final_data = [
            {
                "raw": mapping.raw,
                "mapped": mapping.mapped
            }
            for mapping in mappings
        ]

        print(f"DEBUG load_mappings: Loaded {len(final_data)} mappings from database for '{datapoint}'")
        return final_data

    except Exception as e:
        print(f"ERROR: Failed to load mappings from database for '{datapoint}': {e}")
        import traceback
        traceback.print_exc()
        return []
    finally:
        db.close()


def init_scheduler_csv():
    os.makedirs(os.path.dirname(CSV_PATH_SCHEDULERS), exist_ok=True)
    if not os.path.exists(CSV_PATH_SCHEDULERS):
        with open(CSV_PATH_SCHEDULERS, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(SCHEDULER_FIELDS)


def get_scheduler_by_id(scheduler_id: str) -> Dict[str, Any] | None:
    """Get scheduler from database"""
    db = SessionLocal()
    try:
        scheduler = db.query(Scheduler).filter(Scheduler.scheduler_id == scheduler_id).first()
        if not scheduler:
            return None

        import json
        result = {
            "scheduler_id": scheduler.scheduler_id,
            "api_name": scheduler.api_name,
            "payload_json": scheduler.payload_json,
            "limit": scheduler.limit,
            "is_active": str(scheduler.is_active),
            "last_run": scheduler.last_run.isoformat() if scheduler.last_run else ""
        }

        # Parse payload and merge for backward compatibility
        try:
            payload = json.loads(scheduler.payload_json)
            result.update(payload)
        except:
            pass

        return result
    finally:
        db.close()


def update_last_run(scheduler_id: str):
    """Update last_run timestamp in database"""
    db = SessionLocal()
    try:
        scheduler = db.query(Scheduler).filter(Scheduler.scheduler_id == scheduler_id).first()
        if scheduler:
            scheduler.last_run = datetime.utcnow()
            db.commit()
    finally:
        db.close()

# Replace get_all_schedulers
def get_all_schedulers(limit : Optional[int] = None, offset : Optional[int] = None) -> List[Dict[str, Any]]:
    """Get all schedulers from database with execution history"""
    db = SessionLocal()
    try:
        # Get total count first
        total_count = db.query(Scheduler).count()
        
        # Apply pagination
        query = db.query(Scheduler).order_by(Scheduler.created_at.desc())
        if limit:
            query = query.limit(limit).offset(offset)
        
        schedulers = query.all()
        result = []
        for scheduler in schedulers:
            # Count total jobs in database for this scheduler
            # This is the ground truth - historical run counts may be inflated 
            # (from before our fix to count only saved jobs, not API results)
            jobs_count = db.query(Job).filter(Job.scheduler_id == str(scheduler.scheduler_id)).count()
            
            # Get recent execution history (last 5 runs)
            recent_runs = db.query(SchedulerRun).filter(
                SchedulerRun.scheduler_id == scheduler.scheduler_id
            ).order_by(SchedulerRun.executed_at.desc()).limit(5).all()
            
            execution_history = [
                {
                    "executed_at": run.executed_at.isoformat() if run.executed_at else None,
                    "jobs_fetched": run.jobs_fetched,
                    "has_error": run.has_error,
                    "error_message": run.error_message,
                    "execution_time_seconds": run.execution_time_seconds
                }
                for run in recent_runs
            ]
            
            scheduler_dict = {
                "scheduler_id": scheduler.scheduler_id,
                "api_name": scheduler.api_name,
                "interval_type": scheduler.interval_type,
                "is_active": scheduler.is_active,
                "last_run": scheduler.last_run.isoformat() if scheduler.last_run else "",
                "next_run": scheduler.next_run.isoformat() if scheduler.next_run else "",
                "created_at": scheduler.created_at.isoformat() if scheduler.created_at else "",
                "total_jobs_fetched": jobs_count,  # Database count is ground truth
                "execution_history": execution_history,  # Recent runs with job counts
                "job_title": scheduler.job_title,  # Stored job titles
                "skills": scheduler.skills,  # Stored skills
                "location": scheduler.location,  # Stored location
                "limit_value": scheduler.limit_value,  # Stored limit
                "payload_json": scheduler.payload_json,         # Stored payload
            }

            result.append(scheduler_dict)
        return {
            "schedulers": result,
            "total": total_count,
            "limit": limit,
            "offset": offset
        }

    finally:
        db.close()

# Replace delete_scheduler
def delete_scheduler(scheduler_id: str) -> Dict[str, Any]:
    """Delete scheduler from database"""
    db = SessionLocal()
    try:
        scheduler = db.query(Scheduler).filter(Scheduler.scheduler_id == scheduler_id).first()
        if not scheduler:
            raise ValueError("Scheduler not found")
        db.delete(scheduler)
        db.commit()
        return {"message": "Scheduler deleted successfully", "scheduler_id": scheduler_id}
    finally:
        db.close()

def update_job_scheduler_id(job_ids: List[str], scheduler_id: str):
    """Update scheduler_id for existing jobs."""
    if not job_ids or not scheduler_id:
        return
        
    db = SessionLocal()
    try:
        db.query(Job).filter(Job.id.in_(job_ids)).update(
            {"scheduler_id": scheduler_id},
            synchronize_session=False
        )
        db.commit()
    except Exception as e:
        print(f"Error updating scheduler_ids: {e}")
        db.rollback()
    finally:
        db.close()


def create_scheduler_run(scheduler_id: int, jobs_fetched: int, has_error: bool = False, 
                        error_message: str = None, execution_time_seconds: int = None) -> SchedulerRun:
    """Create a record of a scheduler execution"""
    db = SessionLocal()
    try:
        run = SchedulerRun(
            scheduler_id=scheduler_id,
            jobs_fetched=jobs_fetched,
            has_error=has_error,
            error_message=error_message,
            execution_time_seconds=execution_time_seconds
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return run
    except Exception as e:
        print(f"Error creating scheduler run: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def get_scheduler_runs(scheduler_id: int, limit: int = 10) -> List[Dict[str, Any]]:
    """Get execution history for a scheduler"""
    db = SessionLocal()
    try:
        runs = db.query(SchedulerRun).filter(
            SchedulerRun.scheduler_id == scheduler_id
        ).order_by(SchedulerRun.executed_at.desc()).limit(limit).all()
        
        return [
            {
                "run_id": run.run_id,
                "executed_at": run.executed_at.isoformat() if run.executed_at else None,
                "jobs_fetched": run.jobs_fetched,
                "has_error": run.has_error,
                "error_message": run.error_message,
                "execution_time_seconds": run.execution_time_seconds
            }
            for run in runs
        ]
    finally:
        db.close()


def start_scheduler(scheduler_id: str) -> Dict[str, Any]:
    """Start/activate a scheduler"""
    db = SessionLocal()
    try:
        scheduler = db.query(Scheduler).filter(Scheduler.scheduler_id == scheduler_id).first()
        if not scheduler:
            raise ValueError("Scheduler not found")
        
        scheduler.is_active = True
        db.commit()
        return {"message": "Scheduler started successfully", "scheduler_id": scheduler_id}
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


def stop_scheduler(scheduler_id: str) -> Dict[str, Any]:
    """Stop/deactivate a scheduler"""
    db = SessionLocal()
    try:
        scheduler = db.query(Scheduler).filter(Scheduler.scheduler_id == scheduler_id).first()
        if not scheduler:
            raise ValueError("Scheduler not found")
        
        scheduler.is_active = False
        db.commit()
        return {"message": "Scheduler stopped successfully", "scheduler_id": scheduler_id}
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


def get_jobs_for_scheduler_run(run_id: int) -> Dict[str, Any]:
    """Get all jobs fetched during a specific scheduler run
    
    Args:
        run_id: The ID of the scheduler run
        
    Returns:
        Dictionary containing run details and list of jobs
    """
    from datetime import timedelta
    db = SessionLocal()
    try:
        # Get the run details
        run = db.query(SchedulerRun).filter(SchedulerRun.run_id == run_id).first()
        if not run:
            raise ValueError("Scheduler run not found")
        
        # Get ALL runs for this scheduler ordered by execution time DESC (newest first)
        all_runs = db.query(SchedulerRun).filter(
            SchedulerRun.scheduler_id == run.scheduler_id
        ).order_by(SchedulerRun.executed_at.desc()).all()
        
        # Calculate offset: sum of jobs from all runs that executed AFTER this run
        offset = 0
        for other_run in all_runs:
            if other_run.executed_at > run.executed_at:
                offset += other_run.jobs_fetched
            elif other_run.run_id == run.run_id:
                # We've reached the current run, stop counting
                break
        
        # Fetch jobs with proper offset and limit
        # Jobs are ordered by created_at DESC (newest first), same as runs
        jobs = db.query(Job).filter(
            Job.scheduler_id == str(run.scheduler_id)
        ).order_by(Job.created_at.desc()).offset(offset).limit(run.jobs_fetched).all()
        
        # Convert jobs to dictionaries
        jobs_list = []
        for job in jobs:
            jobs_list.append({
                "id": job.id,
                "title": job.title,
                "company_name": job.company_name,
                "company_website": job.company_website,
                "company_industry": job.company_industry,
                "location": job.location,
                "country": job.country,
                "seniority": job.seniority,
                "description": job.description,
                "job_url": job.job_url,
                "email": job.email,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "company_keywords": job.company_keywords,
                "credits_remaining": job.credits_remaining,
            })
        
        return {
            "run_id": run.run_id,
            "scheduler_id": run.scheduler_id,
            "executed_at": run.executed_at.isoformat() if run.executed_at else None,
            "jobs_fetched": run.jobs_fetched,
            "jobs": jobs_list,
            "total_jobs": len(jobs_list)
        }
    finally:
        db.close()

