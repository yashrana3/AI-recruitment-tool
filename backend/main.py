                              # ॐ #
# main.py
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import threading
from helpers.apis import coresignal, theirstack, mantiks, apollo
from helpers.skill_classifier import classify_skills_from_job, generate_skills_from_headline
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid ,json ,csv, io, requests, time
import pandas as pd 
from dateutil.relativedelta import relativedelta
from database.mysql import SessionLocal
from datetime import datetime, timedelta
from helpers import match
from database.models.data import (
    read_jobs_from_csv, save_jobs_to_csv, save_resumes_to_csv,
    read_matched_from_csv, save_matched_to_csv, read_resumes_from_csv,
    count_resumes_from_csv, read_resumes_for_matching, load_mappings, get_all_schedulers, delete_scheduler, 
    update_job_scheduler_id, file_mapping, DATA_DIR,
    create_scheduler_run, start_scheduler, stop_scheduler, get_scheduler_runs, get_jobs_for_scheduler_run,
    get_scheduler_by_id, update_last_run, populate_mappings_from_csv
)
from database.models.user import User
from database.models.jobs import Job
from database.models.resume import Resume
from database.models.matched import Matched
from database.models.mapping import Mapping
from database.models.scheduler import Scheduler
from database.models.api_credits import ApiCredits

from auth.router import require_viewer, require_admin
app = FastAPI(debug=False)

# to create table in db

@app.on_event("startup")
def on_startup():
    """Create database tables on application startup"""
    from database.mysql import engine, Base
    from database.migrations import run_migrations

    # Create all tables (only creates if they don't exist)
    Base.metadata.create_all(bind=engine)
    
    # Run migrations to add new columns to existing tables
    run_migrations()

    start_scheduler_checker_thread()

    # Populate mappings from CSV files if database is empty

# --- CORS middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://64.227.166.146",
        "http://64.227.166.146:8001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    # allow_origins=["*"],
    # allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SingleItem(BaseModel):
    id: str
    item_type: str = "job"


class ExtractResumeRequest(BaseModel):
    limit: int = 5
    job_id: str
    preference: Optional[str] = "skills"  # "job_title" or "skills"


class MatchRequest(BaseModel):
    job_id: str
    resume_id: str
    score: float


class Technology(BaseModel):
    keyword: str
    slug: str


class CreateMappingRequest(BaseModel):
    raw: str  # The original value (keyword, skill name, etc.) - mapped will be auto-generated


class SchedulerRequest(BaseModel):
    api_name: str                     # coresignal | theirstack | mantiks
    interval: str                     # 2hr | 4hr | daily | weekly | monthly
    payload: Dict[str, Any]   


class CoreSignalRequest(BaseModel):
    limit: int
    city: Optional[str] = None
    country : Optional[str] = None
    skills: List[str]
    logic : str
    scheduler_id: Optional[str] = None  # Optional scheduler_id for tracking

class TheirStackJobRequest(BaseModel):
    limit: int = 1
    max_age_days: int = 1
    city: Optional[list[str]] = None  # No default - don't filter by city unless specified
    country: Optional[list[str]] = None  # No default - don't filter by country unless specified
    employment_statuses: List[str] = []
    skills: Optional[List[str]] = None
    logic: str = "or"
    scheduler_id: Optional[int] = None


class MantiksJobRequest(BaseModel):
    limit: int = 1
    job_age_in_days: int = 90
    job_location_ids: List[int] = [1269750]  # Location IDs from mantiks_countries mapping (REQUIRED)
    #job_title: Optional[List[str]] = None
    job_description: list[str] | None = None # Optional list of job titles/keywords
    logic: str = "or"
    scheduler_id: Optional[str] = None  # Optional scheduler_id for tracking

class ResumesRequest(BaseModel):
    limit: int = 1
    job_id: str = "cs_66329269"

class DeleteResumesRequest(BaseModel):
    resume_ids: List[str]

class ApolloResumesBySkillsRequest(BaseModel):
    skills: List[str]  # List of skills to search for
    limit: int = 25  # Maximum number of resumes to return

class UpdateSchedulerPayloadRequest(BaseModel):
    limit: Optional[int] = None
    interval: Optional[str] = None
    skills: Optional[List[str]] = None

    # location fields
    city: Optional[str] = None
    country: Optional[str] = None
    location_pattern: Optional[List[str]] = None
    job_country_code_or: Optional[List[str]] = None
    job_location_ids: Optional[List[int]] = None


@app.post("/api/match/extract/resumes/coresignal/")
def match_extract_resumes(req: ExtractResumeRequest, current_user = Depends(require_admin)):
    try:
        jobs = read_jobs_from_csv()
        job = next((j for j in jobs if str(j.get("id")) == str(req.job_id)), None)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        location = str(job.get("location")) if job.get("location") else None
        country = str(job.get("country")) if job.get("country") else None
        
        # Get matching preference (default to "skills")
        preference = req.preference or "skills"
        
        # Classify skills from job description
        skill_classification = classify_skills_from_job(job)
        must_skills = skill_classification.get("must_skills", [])
        optional_skills = skill_classification.get("optional_skills", [])
        experience_years = skill_classification.get("experience_years")
        
        # Extract job title for exact matching
        job_title = job.get("title", "")
        
        print(f"CoreSignal search - Job ID: {req.job_id}")
        print(f"Job Title: {job_title}")
        print(f"Location: {location}")
        print(f"Country: {country}")
        print(f"Matching Preference: {preference}")
        print(f"Must Skills: {must_skills} (count: {len(must_skills)})")
        print(f"Optional Skills: {optional_skills} (count: {len(optional_skills)})")
        print(f"Experience Required: {experience_years} years")
        
        # Adjust regression search based on preference
        # If job_title priority, we still need must_skills for initial filtering but will prioritize title match
        use_must_skills_for_search = must_skills if preference == "skills" else []
        use_optional_skills_for_search = optional_skills if preference == "skills" else (must_skills + optional_skills if must_skills else optional_skills)
        
        # Pass skills to regression_search based on preference
        matching_resumes, k = coresignal.regression_search(
            location, 
            keywords=[],  # Legacy parameter, using must_skills + optional_skills instead
            interval=0.13, 
            job_title=job_title if preference == "job_title" else None,  # Strict title matching if preference is job_title
            country=country, 
            max_iterations=10,
            min_results=10,  # Target top 10
            must_skills=use_must_skills_for_search,
            optional_skills=use_optional_skills_for_search
        )
        
        if not matching_resumes or len(matching_resumes) == 0:
            return {
                "message": "No matching resumes found",
                "resume": [],
                "k": k
            }
        
        # OPTIMIZED: Extract resume IDs first (lightweight operation)
        resume_ids_to_enrich = []
        for matching_resume in matching_resumes[:15]:  # Get a few extra for filtering
            try:
                # Handle both dict and ID formats
                if isinstance(matching_resume, (str, int)):
                    resume_id = str(matching_resume)
                elif isinstance(matching_resume, dict):
                    # Try different possible ID fields
                    resume_id = matching_resume.get("id") or matching_resume.get("_id") or matching_resume.get("employee_id")
                    resume_id = str(resume_id) if resume_id else None
                else:
                    continue
                
                if resume_id:
                    # Remove "cs_" prefix if present
                    if resume_id.startswith("cs_"):
                        resume_id = resume_id.replace("cs_", "")
                    resume_ids_to_enrich.append(resume_id)
            except Exception as e:
                print(f"Error extracting resume ID: {e}")
                continue
        
        # Enrich only the candidates we need (top 10-15)
        print(f"Enriching {len(resume_ids_to_enrich)} resumes (optimized from {len(matching_resumes)} search results)...")
        resume_details = []
        for i, resume_id in enumerate(resume_ids_to_enrich):
            print(f"Enriching resume {i+1}/{len(resume_ids_to_enrich)}...")
            try:
                details = coresignal.get_resume_details(resume_id)
                if details:
                    resume_details.append(details)
                else:
                    print(f"No details returned for resume ID: {resume_id}")
            except Exception as e:
                import traceback
                print(f"Error enriching resume {i+1}: {e}")
                print(traceback.format_exc())
                continue
        
        if not resume_details:
            return {
                "message": "No resumes could be enriched",
                "resume": [],
                "k": k
            }
        
        # Score using updated match function with must/optional skills and experience
        scores, scoring_breakdowns = match.get_match(
            job, 
            resume_details, 
            k, 
            job_title=job_title, 
            must_skills=must_skills,
            optional_skills=optional_skills,
            experience_years=experience_years,
            preference=preference
        )
        
        # Save to CSV
        try:
            save_resumes_to_csv(resume_details)
        except Exception as e:
            print(f"Error saving resumes: {e}")
        
        # Add scores and scoring breakdowns to resume details
        for resume_detail in resume_details:
            resume_id = resume_detail["id"]
            if resume_id in scores:
                resume_detail["score"] = round(scores[resume_id], 2)
                # Add scoring breakdown if available
                if resume_id in scoring_breakdowns:
                    resume_detail["scoring_breakdown"] = scoring_breakdowns[resume_id]
                    # Also set hasAllMustSkills for backward compatibility
                    if preference == "skills":
                        resume_detail["hasAllMustSkills"] = (
                            scoring_breakdowns[resume_id].get("must_skills_matched", 0) == 
                            scoring_breakdowns[resume_id].get("must_skills_total", 0) and
                            scoring_breakdowns[resume_id].get("must_skills_total", 0) > 0
                        )
                    else:
                        # For job_title mode, check if job title score is high (good match)
                        resume_detail["hasAllMustSkills"] = scoring_breakdowns[resume_id].get("job_title_score", 0) >= 40
            else:
                # Fallback score
                resume_detail["score"] = 0
                resume_detail["hasAllMustSkills"] = False
        
        # Sort by score (descending), prioritize candidates with all must skills
        def sort_key(resume):
            score = resume.get("score", 0)
            # Check if candidate has all must skills
            resume_skills = resume.get("skills", [])
            if isinstance(resume_skills, str):
                resume_skills = [s.strip().lower() for s in resume_skills.split(",") if s.strip()]
            elif isinstance(resume_skills, list):
                resume_skills = [str(s).strip().lower() for s in resume_skills if s and str(s).strip()]
            
            all_must_matched = True
            if must_skills:
                matched_must = sum(1 for must_skill in must_skills
                                 if any(must_skill in resume_skill or resume_skill in must_skill 
                                        for resume_skill in resume_skills))
                all_must_matched = matched_must >= len(must_skills)
            
            # Sort: all must skills first (0), then by score (higher is better)
            return (0 if all_must_matched else 1, -score)
        
        resume_details.sort(key=sort_key)
        
        # Deduplicate resumes by ID and email before taking top 10
        seen_ids = set()
        seen_emails = set()
        unique_resumes = []
        for resume in resume_details:
            resume_id = str(resume.get("id", ""))
            resume_email = str(resume.get("email", "")).lower().strip() if resume.get("email") else None
            
            # Skip if we've already seen this ID or email
            if resume_id in seen_ids:
                continue
            if resume_email and resume_email in seen_emails:
                continue
            
            # Add to seen sets and unique list
            seen_ids.add(resume_id)
            if resume_email:
                seen_emails.add(resume_email)
            unique_resumes.append(resume)
            
            # Stop once we have 10 unique resumes
            if len(unique_resumes) >= 10:
                break
        
        # Return top 10 unique resumes
        top_10 = unique_resumes
        print(f"CoreSignal match - Returning top {len(top_10)} unique matches (deduplicated from {len(resume_details)} total)")
        
        return {
            "message": "Completed Successfully",
            "resume": top_10
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"CoreSignal endpoint error: {error_trace}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": str(e),
                "type": type(e).__name__,
            }
        )

@app.post("/api/match/resumes/database")
def match_resumes_from_database(req: ExtractResumeRequest, current_user = Depends(require_admin)):
    """
    Match a job against all resumes in the database and return top 10 matches.
    """
    try:
        jobs = read_jobs_from_csv()
        job = next((j for j in jobs if str(j.get("id")) == str(req.job_id)), None)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Get matching preference (default to "skills")
        preference = req.preference or "skills"
        
        # Classify skills from job description
        skill_classification = classify_skills_from_job(job)
        must_skills = skill_classification.get("must_skills", [])
        optional_skills = skill_classification.get("optional_skills", [])
        experience_years = skill_classification.get("experience_years")
        
        # Extract job details
        job_title = job.get("title", "")
        location = str(job.get("location")) if job.get("location") else None
        country = str(job.get("country")) if job.get("country") else None
        
        print(f"Database match - Job ID: {req.job_id}")
        print(f"Job Title: {job_title}")
        print(f"Location: {location}")
        print(f"Country: {country}")
        print(f"Matching Preference: {preference}")
        print(f"Must Skills: {must_skills} (count: {len(must_skills)})")
        print(f"Optional Skills: {optional_skills} (count: {len(optional_skills)})")
        print(f"Experience Required: {experience_years} years")
        
        # Pre-filter resumes at database level to reduce dataset before scoring
        # Extract city from location if available
        city = None
        location_filter_enabled = False
        if location and location.lower() != "none":
            city = location.split(",")[0].strip() if "," in location else location.strip()
        
        # Calculate experience range for filtering (±5 years tolerance)
        experience_min = None
        experience_max = None
        if experience_years is not None:
            experience_min = max(0, experience_years - 5)  # Allow 5 years less
            experience_max = experience_years + 5  # Allow 5 years more
        
        # Extract job title keywords for filtering (if preference is job_title)
        job_title_keywords = None
        if preference == "job_title" and job_title:
            # Extract key words from job title (remove common words)
            common_words = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"}
            title_words = [w.strip() for w in job_title.lower().split() if w.strip() and w.strip() not in common_words]
            if title_words:
                job_title_keywords = title_words[:3]  # Use first 3 meaningful words
        
        # Read resumes with database-level pre-filtering
        # This significantly reduces the dataset before scoring
        all_resumes = read_resumes_for_matching(
            location_country=country,
            location_city=city,
            experience_min=experience_min,
            experience_max=experience_max,
            job_title_keywords=job_title_keywords,
            max_results=500  # Limit to top 500 candidates for scoring (further reduces processing)
        )
        print(f"Database match - Found {len(all_resumes)} resumes after pre-filtering")
        
        # Quick skills pre-filter in Python (after DB filtering for better performance)
        # This further reduces the dataset if we have must_skills
        if must_skills and len(all_resumes) > 100:
            filtered_resumes = []
            for resume in all_resumes:
                resume_skills = resume.get("skills", [])
                if isinstance(resume_skills, str):
                    resume_skills = [s.strip().lower() for s in resume_skills.split(",") if s.strip()]
                elif isinstance(resume_skills, list):
                    resume_skills = [str(s).strip().lower() for s in resume_skills if s and str(s).strip()]
                else:
                    resume_skills = []
                
                # Check if resume has at least one must skill
                has_skill_match = False
                for must_skill in must_skills:
                    must_skill_lower = must_skill.lower()
                    for resume_skill in resume_skills:
                        if must_skill_lower in resume_skill.lower() or resume_skill.lower() in must_skill_lower:
                            has_skill_match = True
                            break
                    if has_skill_match:
                        break
                
                if has_skill_match:
                    filtered_resumes.append(resume)
            
            if filtered_resumes:
                all_resumes = filtered_resumes
                print(f"Database match - Filtered to {len(all_resumes)} resumes with skill matches")
        
        if not all_resumes:
            return {
                "message": "No resumes found matching the criteria",
                "resume": [],
                "k": 0
            }
        
        # Score filtered resumes (much smaller dataset now)
        scores, scoring_breakdowns = match.get_match(
            job,
            all_resumes,
            k=0,  # Not used when must_skills is provided
            job_title=job_title,
            must_skills=must_skills,
            optional_skills=optional_skills,
            experience_years=experience_years,
            preference=preference
        )
        
        # Add scores and scoring breakdowns to resumes
        for resume in all_resumes:
            resume_id = str(resume.get("id", ""))
            if resume_id in scores:
                resume["score"] = round(scores[resume_id], 2)
                if resume_id in scoring_breakdowns:
                    resume["scoring_breakdown"] = scoring_breakdowns[resume_id]
                    # Set hasAllMustSkills for backward compatibility
                    if preference == "skills":
                        resume["hasAllMustSkills"] = (
                            scoring_breakdowns[resume_id].get("must_skills_matched", 0) == 
                            scoring_breakdowns[resume_id].get("must_skills_total", 0) and
                            scoring_breakdowns[resume_id].get("must_skills_total", 0) > 0
                        )
                    else:
                        resume["hasAllMustSkills"] = scoring_breakdowns[resume_id].get("job_title_score", 0) >= 40
            else:
                resume["score"] = 0
                resume["hasAllMustSkills"] = False
        
        # Sort by score (descending), prioritize candidates with all must skills
        def sort_key(resume):
            score = resume.get("score", 0)
            # Check if candidate has all must skills (for skills mode)
            if preference == "skills" and must_skills:
                resume_skills = resume.get("skills", [])
                if isinstance(resume_skills, str):
                    resume_skills = [s.strip().lower() for s in resume_skills.split(",") if s.strip()]
                elif isinstance(resume_skills, list):
                    resume_skills = [str(s).strip().lower() for s in resume_skills if s and str(s).strip()]
                
                matched_must = sum(1 for must_skill in must_skills
                                 if any(must_skill.lower() in resume_skill.lower() or resume_skill.lower() in must_skill.lower()
                                        for resume_skill in resume_skills))
                all_must_matched = matched_must >= len(must_skills)
                return (0 if all_must_matched else 1, -score)
            else:
                # For job_title mode, sort by score only
                return (-score,)
        
        all_resumes.sort(key=sort_key)
        
        # Deduplicate resumes by ID and email before taking top 10
        seen_ids = set()
        seen_emails = set()
        unique_resumes = []
        for resume in all_resumes:
            resume_id = str(resume.get("id", ""))
            resume_email = str(resume.get("email", "")).lower().strip() if resume.get("email") else None
            
            # Skip if we've already seen this ID or email
            if resume_id in seen_ids:
                continue
            if resume_email and resume_email in seen_emails:
                continue
            
            # Add to seen sets and unique list
            seen_ids.add(resume_id)
            if resume_email:
                seen_emails.add(resume_email)
            unique_resumes.append(resume)
            
            # Stop once we have 10 unique resumes
            if len(unique_resumes) >= 10:
                break
        
        # Return top 10 unique resumes
        top_10 = unique_resumes
        print(f"Database match - Returning top {len(top_10)} unique matches (deduplicated from {len(all_resumes)} total)")
        
        return {
            "message": f"Found {len(top_10)} top matches from {len(all_resumes)} resumes in database",
            "resume": top_10
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Database match error: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Error matching resumes from database: {str(e)}"
        )

@app.post("/api/upload/resumes")
def upload_resumes(file: UploadFile = File(...),sheet_name: Optional[str] = None,current_user = Depends(require_admin)):
    try:
        filename = file.filename.lower()
        is_xlsx = filename.endswith(('.xlsx', '.xls'))
        is_csv = filename.endswith('.csv')
        is_tsv = filename.endswith('.tsv') or '\t' in str(file.filename)
        
        if not (is_xlsx or is_csv or is_tsv):
            raise HTTPException(
                status_code=400,
                detail="File must be an XLSX, CSV, or TSV file"
            )
        
        # 2. Read file content
        contents = file.file.read()
        file.file.seek(0)
        
        # 3. Parse file based on type
        all_rows = []
        sheet_info = []
        
        try:
            if is_xlsx:
                # Read XLSX file - handle multiple sheets
                excel_file = pd.ExcelFile(io.BytesIO(contents), engine='openpyxl')
                sheet_names = excel_file.sheet_names
                
                # Skip "Overview" sheet as it's usually metadata
                sheets_to_process = [s for s in sheet_names if s.lower() != 'overview']
                
                # If sheet_name specified, use only that sheet
                if sheet_name:
                    if sheet_name not in sheet_names:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Sheet '{sheet_name}' not found. Available sheets: {sheet_names}"
                        )
                    sheets_to_process = [sheet_name]
                
                # Process each sheet
                for sheet in sheets_to_process:
                    # Try reading with header=0 first (first row as header)
                    df = pd.read_excel(excel_file, sheet_name=sheet, engine='openpyxl', header=0)
                    
                    # Check if we got proper column names (not generic like "Unnamed")
                    if len(df.columns) > 0 and any('Unnamed' in str(col) for col in df.columns):
                        # Try reading again, skipping first row if it's a title
                        df = pd.read_excel(excel_file, sheet_name=sheet, engine='openpyxl', header=1)
                    
                    # Remove completely empty rows and columns
                   # For XLSX files (around line 613)
                    # Remove completely empty rows and columns
                    df = df.dropna(how='all').dropna(axis=1, how='all')
                    # Also remove rows where all string columns are empty/whitespace
                    df = df[~df.astype(str).apply(lambda x: x.str.strip().eq('') | x.eq('nan')).all(axis=1)]

                    # For CSV/TSV files (around line 628)
                    df = pd.read_csv(io.BytesIO(contents), sep=separator, engine='python', header=0)
                    df = df.dropna(how='all').dropna(axis=1, how='all')
                    # Also remove rows where all string columns are empty/whitespace
                    df = df[~df.astype(str).apply(lambda x: x.str.strip().eq('') | x.eq('nan')).all(axis=1)]

                    if len(df) > 0 and len(df.columns) > 0:
                        rows = df.to_dict('records')
                        all_rows.extend(rows)
                        sheet_info.append({
                            'sheet_name': sheet,
                            'rows': len(rows),
                            'columns': len(df.columns)
                        })
            else:
                # Read CSV or TSV
                separator = '\t' if is_tsv else ','
                df = pd.read_csv(io.BytesIO(contents), sep=separator, engine='python', header=0)
                df = df.dropna(how='all').dropna(axis=1, how='all')
                if len(df) > 0:
                    rows = df.to_dict('records')
                    all_rows.extend(rows)
                    sheet_info.append({
                        'sheet_name': 'Sheet1',
                        'rows': len(rows),
                        'columns': len(df.columns)
                    })
            
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file format: {str(e)}"
            )
        
        if len(all_rows) == 0:
            raise HTTPException(
                status_code=400,
                detail="File is empty or has no data rows"
            )
        
        # 4. Define column mapping based on actual file format
               # 4. Define column mapping based on actual file format
        column_mapping = {
            # ID - will be generated if not found
            'id': ['id', 'resume_id', 'candidate_id', 'employee_id', 'person_id', 'apollo contact id'],
            # Email
            'email': ['email address', 'email', 'email_address', 'e-mail', 'email_addr'],
            # Name - combine First Name + Last Name
            'first_name': ['first name', 'firstname', 'fname', 'given name'],
            'last_name': ['last name', 'lastname', 'lname', 'surname', 'family name'],
            'full_name': ['full name', 'name', 'fullname', 'candidate_name', 'person_name'],
            # LinkedIn
            'linkedin_url': [
                'profile url', 'linkedin_url', 'linkedin', 'linkedin_profile', 
                'linkedin_link', 'profile_url', 'person linkedin url'
            ],
            # Headline - can use Title or combine Title + Company
            'headline': [
                'headline', 'title_line', 'job_headline', 'current_title', 
                'title', 'position', 'role'
            ],
            # Title
            'title': [
                'current title', 'title', 'job_title', 'current_job_title', 
                'position', 'role'
            ],
            # Location - handle City, State, Country separately
            'location_full': [
                'general location', 'location_full', 'location', 'full_location', 
                'address', 'city_location', 'city', 'state'
            ],
            'location_country': [
                'location_country', 'country', 'country_name', 'nation'
            ],
            'location_city': ['city'],
            'location_state': ['state'],
            # Summary (might not be in file)
            'summary': ['summary', 'bio', 'about', 'description', 'profile_summary', 'keywords'],
            # Skills - Technologies column is comma-separated
            'skills': [
                'skills', 'skill', 'technologies', 'tech_skills', 
                'competencies', 'expertise', 'technology'
            ],
            # Experience - calculate from start date
            'position_start_date': [
                'current position start date', 'start_date', 'position_start', 
                'current_start_date', 'start date'
            ],
            'experience': [
                'experience', 'years_experience', 'exp_years', 
                'experience_years', 'total_experience'
            ],
            # Company info (can be used for headline if needed)
            'company_name': ['company name', 'company_name', 'company']
        }
        
        # 5. Map actual columns to database columns (case-insensitive)
        if len(all_rows) > 0:
            actual_columns = list(all_rows[0].keys())
        else:
            actual_columns = []
        
        column_map = {}  # Maps actual column name -> database column name
        
        for db_col, possible_names in column_mapping.items():
            for actual_col in actual_columns:
                actual_col_lower = actual_col.lower().strip()
                if actual_col_lower in [name.lower() for name in possible_names]:
                    column_map[actual_col] = db_col
                    break
        
        # Get reverse mapping (db_col -> actual_col)
        reverse_map = {v: k for k, v in column_map.items()}
        
        # 6. Validate and transform data
        valid_resumes = []
        invalid_rows = []
        duplicate_count = 0
        
        db = SessionLocal()
        try:
            # Get existing IDs and emails for duplicate checking
            existing_resumes = db.query(Resume.id, Resume.email).all()
            existing_ids = {str(r.id) for r in existing_resumes}
            existing_emails = {
                str(r.email).lower().strip() 
                for r in existing_resumes 
                if r.email
            }
            
            def get_field(row, db_col_name: str, default=None):
                """Helper to extract field value from row"""
                actual_col = reverse_map.get(db_col_name)
                if actual_col and actual_col in row:
                    val = row[actual_col]
                    if pd.notna(val):
                        val_str = str(val).strip()
                        if val_str and val_str.lower() not in ['nan', 'n/a', 'none', '']:
                            return val_str
                return default
            
            def calculate_experience(start_date_str):
                """Calculate years of experience from start date"""
                if not start_date_str or str(start_date_str).lower() in ['nan', 'n/a', 'none', '']:
                    return None
                
                try:
                    # Try parsing different date formats
                    date_str = str(start_date_str).strip()
                    
                    # Handle formats like "2024-10", "2024/10", "Oct 2024", etc.
                    if '-' in date_str or '/' in date_str:
                        parts = date_str.replace('/', '-').split('-')
                        if len(parts) >= 2:
                            year = int(parts[0])
                            month = int(parts[1]) if len(parts) > 1 else 1
                            start_date = datetime(year, month, 1)
                        else:
                            return None
                    else:
                        # Try parsing as full date
                        start_date = pd.to_datetime(date_str)
                        if pd.isna(start_date):
                            return None
                    
                    # Calculate years from start date to now
                    now = datetime.now()
                    delta = relativedelta(now, start_date)
                    years = delta.years + (delta.months / 12.0)
                    return int(years) if years > 0 else None
                except:
                    return None
            
            def extract_country_from_location(location_str):
                """Extract country from location string"""
                if not location_str:
                    return None
                
                location_lower = str(location_str).lower()
                
                # Common country patterns
                country_patterns = {
                    'netherlands': 'Netherlands',
                    'belgium': 'Belgium',
                    'tunisia': 'Tunisia',
                    'australia': 'Australia',
                    'romania': 'Romania',
                    'united states': 'United States',
                    'usa': 'United States',
                    'us': 'United States',
                    'uk': 'United Kingdom',
                    'united kingdom': 'United Kingdom',
                    'canada': 'Canada',
                    'india': 'India',
                    'germany': 'Germany',
                    'france': 'France',
                    'spain': 'Spain',
                    'italy': 'Italy'
                }
                
                for pattern, country in country_patterns.items():
                    if pattern in location_lower:
                        return country
                
                # If location contains comma, last part might be country
                if ',' in location_str:
                    parts = location_str.split(',')
                    return parts[-1].strip() if parts else None
                
                return None
            
            def extract_skills_from_headline(headline_str):
                """Try to extract skills from headline text"""
                if not headline_str:
                    return []
                
                # Common tech skills to look for
                tech_keywords = [
                    'java', 'python', 'javascript', 'react', 'angular', 'vue', 'node',
                    'spring', 'spring boot', 'django', 'flask', 'express',
                    'sql', 'mysql', 'postgresql', 'mongodb',
                    'aws', 'azure', 'gcp', 'docker', 'kubernetes',
                    'git', 'jenkins', 'ci/cd', 'agile', 'scrum',
                    'oauth', 'maven', 'gradle', 'rest api', 'graphql',
                    'microservices', 'api', 'backend', 'frontend', 'fullstack'
                ]
                
                headline_lower = headline_str.lower()
                found_skills = []
                
                for skill in tech_keywords:
                    if skill in headline_lower:
                        found_skills.append(skill.title())
                
                return found_skills
            
            for idx, row in enumerate(all_rows, start=2):  # Start at 2 (row 1 is header)
                try:
                    # Generate ID if not present
                    resume_id = get_field(row, 'id')
                    if not resume_id:
                        # Try to generate from email
                        email = get_field(row, 'email')
                        if email:
                            # Use email as base for ID
                            resume_id = f"upload_{email.split('@')[0]}_{uuid.uuid4().hex[:8]}"
                        else:
                            # Generate random ID
                            resume_id = f"upload_{uuid.uuid4().hex}"
                    
                    # Check duplicate by ID
                    if resume_id in existing_ids:
                        duplicate_count += 1
                        continue
                    
                    # Extract email
                    email = get_field(row, 'email')
                    if email:
                        email_lower = email.lower().strip()
                        # Check duplicate by email
                        if email_lower in existing_emails:
                            duplicate_count += 1
                            continue
                        existing_emails.add(email_lower)  # Track for this batch
                    
                                        # Combine First Name + Last Name for full_name
                    first_name = get_field(row, 'first_name', '').strip()
                    last_name = get_field(row, 'last_name', '').strip()
                    full_name_from_parts = f"{first_name} {last_name}".strip() if (first_name or last_name) else None
                    full_name = get_field(row, 'full_name') or full_name_from_parts
                    

                    location_full = get_field(row, 'location_full')
                    location_country = get_field(row, 'location_country')
                    
                     # At least one of these must be present: email, full_name, linkedin_url
                    linkedin_url = get_field(row, 'linkedin_url')
                    if not email and not full_name and not linkedin_url:
                        invalid_rows.append({
                            'row': idx,
                            'error': 'Row has no meaningful data (missing email, full_name, and linkedin_url)'
                        })
                        continue

                    # If location_full not found, try to build from City, State, Country
                    if not location_full:
                        city = get_field(row, 'location_city', '')
                        state = get_field(row, 'location_state', '')
                        country = get_field(row, 'location_country', '')
                        
                        location_parts = []
                        if city:
                            location_parts.append(city)
                        if state:
                            location_parts.append(state)
                        if country:
                            location_parts.append(country)
                        
                        if location_parts:
                            location_full = ', '.join(location_parts)
                    
                    # Set country if not already set
                    if not location_country:
                        location_country = get_field(row, 'location_country')
                        if not location_country and location_full:
                            location_country = extract_country_from_location(location_full)
                    
                    # Extract skills - prioritize Technologies column, then skills column, then headline
                    skills = []
                    
                    # First, try Technologies column (comma-separated)
                    technologies_col = get_field(row, 'skills')
                    if technologies_col:
                        # Parse Technologies column (comma-separated string)
                        if isinstance(technologies_col, str):
                            # Split by comma and clean
                            tech_list = [t.strip() for t in technologies_col.split(',') if t.strip()]
                            # Filter out very long strings (likely not skills but descriptions)
                            skills = [t for t in tech_list if len(t) < 100]
                    
                    # If no skills from Technologies, try skills column (JSON array)
                    if not skills:
                        skills_col = get_field(row, 'skills')
                        if skills_col:
                            # Parse skills string
                            if skills_col.strip().startswith('['):
                                try:
                                    skills = json.loads(skills_col)
                                except:
                                    skills = [s.strip() for s in skills_col.replace(';', ',').split(',') if s.strip()]
                            else:
                                skills = [s.strip() for s in skills_col.replace(';', ',').split(',') if s.strip()]
                    
                    # If no skills found, try extracting from headline or title
                    if not skills:
                        headline = get_field(row, 'headline')
                        if not headline:
                            # Use title as headline if headline not available
                            headline = get_field(row, 'title')
                            # Optionally combine with company name
                            company = get_field(row, 'company_name')
                            if company and headline:
                                headline = f"{headline} at {company}"
                        
                        if headline:
                            skills = extract_skills_from_headline(headline)
                    
                    # If still no skills, try summary/keywords
                    if not skills:
                        summary = get_field(row, 'summary')
                        if summary:
                            skills = extract_skills_from_headline(summary)
                    
                    # If still no skills, use OpenAI gpt-4o-mini to generate 3-4 original skills
                    # based on the headline or job title
                    if not skills:
                        headline_for_gen = get_field(row, 'headline') or get_field(row, 'title')
                        title_for_gen = get_field(row, 'title')
                        
                        if headline_for_gen or title_for_gen:
                            print(f"Generating skills with OpenAI for: {full_name or email or resume_id}")
                            skills = generate_skills_from_headline(
                                headline=headline_for_gen,
                                title=title_for_gen
                            )
                            if skills:
                                print(f"Generated {len(skills)} skills with OpenAI: {skills}")
                    
                    # Calculate experience from start date
                    experience = None
                    exp_col = get_field(row, 'experience')
                    if exp_col:
                        try:
                            experience = int(float(str(exp_col)))
                        except:
                            pass
                    
                    # If no experience from column, calculate from start date
                    if experience is None:
                        start_date = get_field(row, 'position_start_date')
                        if start_date:
                            experience = calculate_experience(start_date)
                    
                    # Get headline - use title if headline not available
                    headline = get_field(row, 'headline')
                    if not headline:
                        headline = get_field(row, 'title')
                        # Optionally add company name
                        company = get_field(row, 'company_name')
                        if company and headline:
                            headline = f"{headline} at {company}"
                    
                    print(skills)
                    print(list[skills])
                    
                    # Build resume data dict matching database schema
                    resume_data = {
                        'id': resume_id,
                        'email': email,
                        'full_name': full_name,
                        'linkedin_url': get_field(row, 'linkedin_url'),
                        'headline': headline,
                        'summary': get_field(row, 'summary'),
                        'location_country': location_country,
                        'location_full': location_full,
                        'skills': skills,  # Stored as JSON array
                        'title': get_field(row, 'title'),
                        'experience': experience,
                        'created_at': datetime.now(),
                    }

                    has_meaningful_data = (
                        email or 
                        full_name or 
                        headline or 
                        get_field(row, 'title') or 
                        (skills and len(skills) > 0)
                    )
                    
                    if not has_meaningful_data:
                        invalid_rows.append({
                            'row': idx,
                            'error': 'Row has no meaningful data (only linkedin_url provided, missing email, name, headline, title, and skills)'
                        })
                        continue
                    
                    valid_resumes.append(resume_data)
                    existing_ids.add(resume_id)  # Track for this batch
                    
                except Exception as e:
                    invalid_rows.append({
                        'row': idx,
                        'error': f'Error processing row: {str(e)}'
                    })
                    continue
            
            # 7. Save valid resumes to database
            saved_count = 0
            if valid_resumes:
                save_resumes_to_csv(valid_resumes)
                print(valid_resumes)
                saved_count = len(valid_resumes)
            
        finally:
            db.close()
        
        # 8. Return response
        return {
            'message': 'Upload completed',
            'total_rows': len(all_rows),
            'saved': saved_count,
            'duplicates': duplicate_count,
            'invalid': len(invalid_rows),
            'invalid_rows': invalid_rows if invalid_rows else None,
            'sheets_processed': sheet_info,
            'column_mapping': {
                'mapped_columns': column_map,
                'available_columns': actual_columns,
                'unmapped_columns': [col for col in actual_columns if col not in column_map]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Upload resume error: {error_trace}")
        raise HTTPException(
            status_code=500,
            detail={
                'error': 'Internal Server Error',
                'message': str(e),
                'type': type(e).__name__
            }
        )
        
@app.post("/api/match/extract/resumes/apollo/")
def match_extract_resumes_apollo(req: ExtractResumeRequest, current_user = Depends(require_admin)):
    """
    Extract and match resumes using Apollo.io API based on job requirements.
    Same logic as CoreSignal endpoint but uses Apollo.io for resume search.
    """
    try:
        jobs = read_jobs_from_csv()
        job = next((j for j in jobs if str(j.get("id")) == str(req.job_id)), None)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # LOCATION (this is your "city")
        location = str(job.get("location"))
        
        # Get matching preference (default to "skills")
        preference = req.preference or "skills"
        
        # Classify skills from job description
        skill_classification = classify_skills_from_job(job)
        must_skills = skill_classification.get("must_skills", [])
        optional_skills = skill_classification.get("optional_skills", [])
        experience_years = skill_classification.get("experience_years")

        # Extract additional job data for better search
        job_title = job.get("title", "")
        seniority = job.get("seniority", "")
        country = job.get("country", "")

        # Debug: print job details
        print(f"Apollo search - Job ID: {req.job_id}")
        print(f"Job Title: {job_title}")
        print(f"Location: {location}")
        print(f"Country: {country}")
        print(f"Seniority: {seniority}")
        print(f"Matching Preference: {preference}")
        print(f"Must Skills: {must_skills} (count: {len(must_skills)})")
        print(f"Optional Skills: {optional_skills} (count: {len(optional_skills)})")
        print(f"Experience Required: {experience_years} years")

        # Adjust regression search based on preference
        use_must_skills_for_search = must_skills if preference == "skills" else []
        use_optional_skills_for_search = optional_skills if preference == "skills" else (must_skills + optional_skills if must_skills else optional_skills)
        
        # Use job title and seniority for better matching with loop protection
        matching_resumes, k = apollo.regression_search(
            location, 
            keywords=[],  # Legacy parameter, using must_skills + optional_skills instead
            interval=0.13,
            job_title=job_title if preference == "job_title" else job_title,  # Always use for filtering
            seniority=seniority,
            max_iterations=8,
            max_enrichments=30,  # Increased for top 10
            must_skills=use_must_skills_for_search,
            optional_skills=use_optional_skills_for_search
        )

        print(f"Regression search returned: {len(matching_resumes)} resumes, k={k}")

        # Check if any resumes were found
        if not matching_resumes or len(matching_resumes) == 0:
            return {
                "message": "No matching resumes found",
                "resume": [],
                "k": k
            }
        
        # OPTIMIZED: Extract resume IDs first (lightweight operation)
        resume_ids_to_enrich = []
        for matching_resume in matching_resumes[:15]:  # Get a few extra for filtering
            try:
                # Apollo search_resumes returns dicts with 'id' field
                if isinstance(matching_resume, dict):
                    person_id = matching_resume.get("id")
                    if person_id:
                        resume_ids_to_enrich.append(person_id)
                elif isinstance(matching_resume, (str, int)):
                    resume_ids_to_enrich.append(str(matching_resume))
            except Exception as e:
                print(f"Error extracting resume ID: {e}")
                continue
        
        # Enrich only the candidates we need (top 10-15)
        print(f"Enriching {len(resume_ids_to_enrich)} resumes (optimized from {len(matching_resumes)} search results)...")
        resume_details = []
        for i, person_id in enumerate(resume_ids_to_enrich):
            print(f"Enriching resume {i+1}/{len(resume_ids_to_enrich)}...")
            try:
                details = apollo.get_resume_details(person_id)
                if details:
                    resume_details.append(details)
                    # Debug: Check resume data
                    print(f"Resume {i+1} details - ID: {details.get('id')}")
                    print(f"Resume {i+1} details - Location: {details.get('location_full')}")
                    print(f"Resume {i+1} details - Skills: {details.get('skills', [])[:5]}")
            except Exception as e:
                print(f"Error enriching resume {i+1}: {e}")
                continue

        if not resume_details:
            return {
                "message": "No resumes could be enriched",
                "resume": [],
                "k": k
            }

        print(f"Successfully enriched {len(resume_details)} resumes")

        # Score using updated match function with must/optional skills and experience
        scores, scoring_breakdowns = match.get_match(
            job, 
            resume_details, 
            k, 
            job_title=job_title, 
            must_skills=must_skills,
            optional_skills=optional_skills,
            experience_years=experience_years,
            preference=preference
        )
        
        # Save to CSV
        try:
            save_resumes_to_csv(resume_details)
        except Exception as e:
            print(f"Error saving resumes to CSV: {e}")
        
        print(f"Scores: {scores}")

        # Add scores and scoring breakdowns to resume details
        for resume_detail in resume_details:
            resume_id = resume_detail["id"]
            if resume_id in scores:
                resume_detail["score"] = round(scores[resume_id], 2)
                # Add scoring breakdown if available
                if resume_id in scoring_breakdowns:
                    resume_detail["scoring_breakdown"] = scoring_breakdowns[resume_id]
                    # Set hasAllMustSkills for backward compatibility
                    if preference == "skills":
                        resume_detail["hasAllMustSkills"] = (
                            scoring_breakdowns[resume_id].get("must_skills_matched", 0) == 
                            scoring_breakdowns[resume_id].get("must_skills_total", 0) and
                            scoring_breakdowns[resume_id].get("must_skills_total", 0) > 0
                        )
                    else:
                        # For job_title mode, check if job title score is high (good match)
                        resume_detail["hasAllMustSkills"] = scoring_breakdowns[resume_id].get("job_title_score", 0) >= 40
                print(f"Score calculated for {resume_id}: {scores[resume_id]}")
            else:
                # Fallback score
                resume_detail["score"] = 0
                resume_detail["hasAllMustSkills"] = False
                print(f"Warning: Score not calculated for {resume_id}, using fallback score: 0")

        # Sort by score (descending), prioritize candidates with all must skills
        def sort_key(resume):
            score = resume.get("score", 0)
            # Check if candidate has all must skills
            resume_skills = resume.get("skills", [])
            if isinstance(resume_skills, str):
                resume_skills = [s.strip().lower() for s in resume_skills.split(",") if s.strip()]
            elif isinstance(resume_skills, list):
                resume_skills = [str(s).strip().lower() for s in resume_skills if s and str(s).strip()]
            
            all_must_matched = True
            if must_skills:
                matched_must = sum(1 for must_skill in must_skills
                                 if any(must_skill in resume_skill or resume_skill in must_skill 
                                        for resume_skill in resume_skills))
                all_must_matched = matched_must >= len(must_skills)
            
            # Sort: all must skills first (0), then by score (higher is better)
            return (0 if all_must_matched else 1, -score)
        
        resume_details.sort(key=sort_key)
        
        # Deduplicate resumes by ID and email before taking top 10
        seen_ids = set()
        seen_emails = set()
        unique_resumes = []
        for resume in resume_details:
            resume_id = str(resume.get("id", ""))
            resume_email = str(resume.get("email", "")).lower().strip() if resume.get("email") else None
            
            # Skip if we've already seen this ID or email
            if resume_id in seen_ids:
                continue
            if resume_email and resume_email in seen_emails:
                continue
            
            # Add to seen sets and unique list
            seen_ids.add(resume_id)
            if resume_email:
                seen_emails.add(resume_email)
            unique_resumes.append(resume)
            
            # Stop once we have 10 unique resumes
            if len(unique_resumes) >= 10:
                break
        
        # Return top 10 unique resumes
        top_10 = unique_resumes
        print(f"Apollo match - Returning top {len(top_10)} unique matches (deduplicated from {len(resume_details)} total)")

        return {
            "message": "Completed Successfully",
            "resume": top_10
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Apollo endpoint error: {error_trace}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": str(e),
                "type": type(e).__name__,
            }
        )


@app.post("/api/apollo/resumes/by-skills")
def fetch_apollo_resumes_by_skills(req: ApolloResumesBySkillsRequest, current_user = Depends(require_admin)):
    """
    Fetch resumes from Apollo.io API using only skills as parameter - Admin only.
    No location filter - searches globally and filters by skills.

    Request Body:
    {
        "skills": ["python", "javascript", "react"],
        "limit": 25
    }

    Returns:
    {
        "count": number of resumes found,
        "resumes": [list of resume dictionaries],
        "skills_searched": [list of skills used in search]
    }
    """
    try:
        if not req.skills or len(req.skills) == 0:
            raise HTTPException(
                status_code=400,
                detail="Skills parameter is required and cannot be empty"
            )

        # Fetch resumes from Apollo using skills only
        resumes = apollo.search_resumes_by_skills(
            skills=req.skills,
            limit=req.limit
        )

        return {
            "count": len(resumes),
            "resumes": resumes,
            "skills_searched": req.skills
        }

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Apollo resumes by skills endpoint error: {error_trace}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": str(e),
                "type": type(e).__name__,
            }
        )

@app.post("/api/match/")
def make_match(req: MatchRequest, current_user = Depends(require_admin)):
    try:
        matched_data = read_matched_from_csv()
        if str(req.resume_id) in [str(m["resume_id"]) for m in matched_data if str(m["job_id"]) == str(req.job_id)]:
            raise {"message": "Already Matched"}
        jobs = read_jobs_from_csv()
        job = next((j for j in jobs if str(j.get("id")) == str(req.job_id)), None)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        resumes = read_resumes_from_csv()
        resume = next((r for r in resumes if str(r.get("id")) == str(req.resume_id)), None)
        if not resume:
            raise HTTPException(status_code=404, detail="Resume not found")
        data_to_be_saved = {
            "job_id": str(req.job_id),
            "resume_id": str(req.resume_id),
            "score": str(req.score)
        }
        # ✅ Save to CSV
        save_matched_to_csv([data_to_be_saved])
        return {
            "message": "Completed Successfully",
            "details": data_to_be_saved
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": str(e),
                "type": type(e).__name__,
            }
        )


@app.get("/api/matched")
def get_all_matched(
    limit: Optional[int] = 1,
    offset: Optional[int] = 0,
    current_user = Depends(require_viewer),
):
    """Fetch all matched data from CSV.
    Optional:
    - q: search across all fields
    - limit: max number of results
    - offset: starting index for pagination
    """
    try:
        matched = read_matched_from_csv()
        total_count = len(matched)
        p = int(min(limit, len(matched)))
        if limit:
            matched = matched[offset : offset + limit]
        return {
            "count": total_count,
            "matched": matched,
            "offset": offset,
            "limit": limit or len(matched),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": str(e),
                "type": type(e).__name__,
            }
        )


@app.get("/api/resumes")
def get_all_resumes(
    q: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
    current_user = Depends(require_viewer),
):
    """Fetch resumes from database with pagination and search.
    Optimized to use database-level filtering and pagination for better performance.
    
    Optional:
    - q: search across all fields (database-level filtering)
    - limit: max number of results (default: 10)
    - offset: starting index for pagination
    """
    try:
        # Use optimized database query with pagination and filtering
        # Default limit to 10 if not specified to prevent loading all resumes
        effective_limit = limit if limit is not None else 10
        
        # Get total count for pagination (with search filter if provided)
        total_count = count_resumes_from_csv(search_query=q)
        
        # Fetch resumes with database-level pagination and filtering
        resumes = read_resumes_from_csv(
            limit=effective_limit,
            offset=offset,
            search_query=q
        )
        
        return {
            "count": total_count,
            "resumes": resumes,
            "offset": offset,
            "limit": effective_limit,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": str(e),
                "type": type(e).__name__,
            }
        )

@app.delete("/api/resumes/{resume_id}")
def delete_resume(resume_id: str, current_user = Depends(require_admin)):
    """
    Delete a resume from the database by ID.
    Also deletes any matched records associated with this resume.
    Admin only.
    """
    db = SessionLocal()
    try:
        # Check if resume exists
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        
        if not resume:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "Resume not found",
                    "message": f"Resume with ID '{resume_id}' does not exist",
                    "resume_id": resume_id
                }
            )
        
        # Store resume info for response
        resume_email = resume.email
        resume_name = resume.full_name
        
        # Delete associated matched records first (to maintain referential integrity)
        matched_records = db.query(Matched).filter(Matched.resume_id == resume_id).all()
        matched_count = len(matched_records)
        
        for matched in matched_records:
            db.delete(matched)
        
        # Delete the resume
        db.delete(resume)
        db.commit()
        
        return {
            "message": "Resume deleted successfully",
            "resume_id": resume_id,
            "resume_name": resume_name,
            "resume_email": resume_email,
            "matched_records_deleted": matched_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_trace = traceback.format_exc()
        print(f"Delete resume error: {error_trace}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": str(e),
                "type": type(e).__name__,
            }
        )
    finally:
        db.close()

@app.get("/api/jobs")
def get_all_jobs(
    q: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
    scheduler_id: Optional[str] = None,
    current_user = Depends(require_viewer),
):
    """Fetch all jobs from database.
    Jobs are ordered by most recent first (created_at DESC).
    Optional:
    - q: search in title / company_name / location
    - limit: max number of results per page
    - offset: starting index for pagination
    - scheduler_id: filter by specific scheduler_id
    """
    try:
        jobs = read_jobs_from_csv()  # Already ordered by created_at DESC
        total_count = len(jobs)

        # Filter by scheduler_id if provided
        if scheduler_id:
            jobs = [job for job in jobs if job.get("scheduler_id") == scheduler_id]

        # Apply search filter
        if q:
            q_lower = q.lower()
            jobs = [
                job for job in jobs
                if q_lower in job["title"].lower()
                or q_lower in job["company_name"].lower()
                or q_lower in job["location"].lower()
            ]

        # Get total count after filtering
        total_count = len(jobs)

        # Sort jobs: numeric scheduler_ids first (descending), then text scheduler_ids
        def sort_key(job):
            scheduler_id = job.get("scheduler_id")
            if scheduler_id is None:
                return (1, "")  # None values go to end
            
            # Try to convert to integer
            try:
                numeric_id = int(scheduler_id)
                return (0, -numeric_id)  # 0 = numeric, negative for descending order
            except (ValueError, TypeError):
                return (1, scheduler_id)  # 1 = text, sort alphabetically
        
        jobs.sort(key=sort_key)

        # Apply pagination (offset and limit)
        if offset:
            jobs = jobs[offset:]
        if limit:
            jobs = jobs[:limit]

        return {
            "count": total_count,
            "jobs": jobs,
            "offset": offset or 0,
            "limit": limit or total_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": str(e),
                "type": type(e).__name__,
            }
        )

@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str, current_user=Depends(require_admin)):
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == str(job_id)).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        db.delete(job)
        db.commit()

        return {
            "message": "Job deleted successfully",
            "job_id": job_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.get("/api/item")
def get_item(id: str, item_type: str = "job", current_user = Depends(require_viewer)):
    try:
        if (item_type).lower() == "job":
            datapoints = read_jobs_from_csv()
        elif (item_type).lower() == "resume":
            datapoints = read_resumes_from_csv()
        try:
            datapoints = [
                data for data in datapoints
                if id in data["id"]
            ]
            return {
                "data": datapoints[0]
            }
        except Exception as e:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "Item Not Found",
                    "message": str(e),
                    "type": type(e).__name__,
                }
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": str(e),
                "type": type(e).__name__,
            }
        )

@app.post("/api/create/jobs/coresignals")
def create_cs_jobs(req: CoreSignalRequest, current_user = Depends(require_admin)):
    try:
        # Validate that at least one of city or country is provided
        if not req.city and not req.country:
            raise HTTPException(
                status_code=400,
                detail="At least one of 'city' or 'country' must be provided"
            )

        logic_normalized = req.logic.lower().strip() if req.logic else "or"
        if logic_normalized not in ["or", "and"]:
            raise HTTPException(
                status_code=400,
                detail="Logic parameter must be either 'or' or 'and'"
            )

        jobs = read_jobs_from_csv()
        older_ids = {job["id"] for job in jobs}
        print(f"Existing jobs in CSV: {len(older_ids)}")

        job_details_list = coresignal.fetch_jobs_with_details(
            city=req.city,
            country=req.country,
            skills=req.skills,
            logic=logic_normalized,
            limit=req.limit,
            existing_job_ids=older_ids
        )

        save_jobs_to_csv(job_details_list, scheduler_id=req.scheduler_id)

        return {
            "message": "Completed Successfully",
            "jobs": job_details_list,
            "count": len(job_details_list),
            # "total_found": len(matching_jobs), # These stats are not returned by helper currently, simplified
            # "skipped_duplicates": skipped
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": str(e),
                "type": type(e).__name__,
            }
        )


@app.post("/api/create/jobs/theirstack")
def create_ts_jobs(req: TheirStackJobRequest, current_user = Depends(require_admin)):
    try:
        # Validate that at least city or country is provided
        has_city = req.city and len(req.city) > 0 and any(c.strip() for c in req.city)
        has_country = req.country and len(req.country) > 0 and any(c.strip() for c in req.country)
        if not has_city and not has_country:
            raise HTTPException(
                status_code=400,
                detail="At least one of 'city' or 'country' must be provided"
            )
        
        # Validate logic parameter (must be "or" or "and")
        logic_normalized = req.logic.lower().strip() if req.logic else "or"
        if logic_normalized not in ["or", "and"]:
            raise HTTPException(
                status_code=400,
                detail="Logic parameter must be either 'or' or 'and'"
            )

        jobs = theirstack.fetch_theirstack_jobs(
            limit=int(req.limit),
            max_age_days=int(req.max_age_days),
            city=req.city,
            country=req.country,
            employment_statuses=req.employment_statuses,
            skills=req.skills,
            logic=logic_normalized, # Use normalized logic (only applies to technology slug)
        )
        job_details_list = []

        for job_details in jobs:
            job_details_list.append(job_details)
        # ✅ Save to CSV
        save_jobs_to_csv(job_details_list, scheduler_id=req.scheduler_id)
        return {
            "message": "Completed Successfully",
            "jobs": job_details_list
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": str(e),
                "type": type(e).__name__,
            }
        )


@app.post("/api/create/jobs/mantiks")
def create_mantiks_jobs(req: MantiksJobRequest, current_user = Depends(require_admin)):
    try:
        if not req.job_location_ids:
            raise HTTPException(
                status_code=400,
                detail="job_location_ids is required and cannot be empty"
            )

        logic_normalized = req.logic.lower().strip() if req.logic else "or"
        if logic_normalized not in ["or", "and"]:
            raise HTTPException(
                status_code=400,
                detail="Logic parameter must be either 'or' or 'and'"
            )

        jobs = mantiks.fetch_mantiks_jobs(
            limit=int(req.limit),
            job_age_in_days=int(req.job_age_in_days),
            job_location_ids=req.job_location_ids,
            job_description=req.job_description,
            #job_title=req.job_title,
            logic=logic_normalized,
        )

        # ✅ Save to CSV
        save_jobs_to_csv(jobs, scheduler_id=req.scheduler_id)
        return {
            "message": "Completed Successfully",
            "jobs": jobs,
            "count": len(jobs),
            "scheduler_id": req.scheduler_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": str(e),
                "type": type(e).__name__,
            }
        )


@app.get("/mappings", response_model=List[Technology])
def get_mappings(
    q: str = "",
    limit: int = 20,
    datapoint: str = "technologies",
    current_user = Depends(require_viewer),
):
    """Fetch technologies/countries/industries from database with optional search query 'q'."""
    try:
        # Load mappings data from database
        final_data = load_mappings(datapoint)

        # Debug logging
        print(f"DEBUG get_mappings: datapoint={datapoint}, loaded {len(final_data)} items from database")

        if not final_data:
            print(f"WARNING: No data loaded for datapoint '{datapoint}'. Available datapoints: {list(file_mapping.keys())}")
            return []

        # Apply search filter if query provided
        if q:
            q_lower = q.lower()
            final_data = [
                data for data in final_data
                if q_lower in data.get("raw", "").lower() or q_lower in data.get("mapped", "").lower()
            ]
            print(f"DEBUG: After filtering with q='{q}', {len(final_data)} items remain")

        # Convert dicts to Technology models and limit results
        final_models = [
            Technology(keyword=data.get("raw", ""), slug=data.get("mapped", ""))
            for data in final_data[:limit]
            if data.get("raw") or data.get("mapped")  # Only include non-empty entries
        ]

        print(f"DEBUG: Returning {len(final_models)} models")
        return final_models

    except Exception as e:
        print(f"ERROR in get_mappings: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load mappings: {str(e)}"
        )


def generate_slug(text: str) -> str:
    """Generate a slug from text (lowercase, replace spaces with hyphens, remove special chars)."""
    import re
    # Convert to lowercase
    slug = text.lower().strip()
    # Replace spaces and underscores with hyphens
    slug = re.sub(r'[\s_]+', '-', slug)
    # Remove special characters except hyphens
    slug = re.sub(r'[^a-z0-9\-]', '', slug)
    # Replace multiple hyphens with single hyphen
    slug = re.sub(r'-+', '-', slug)
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    return slug


@app.post("/api/mappings")
def create_mapping(
    req: CreateMappingRequest,
    current_user = Depends(require_admin),
):
    """Create a new skill mapping entry in the database. Only raw (skill name) is required, mapped (slug) is auto-generated."""
    try:
        # Validate that raw is not empty
        if not req.raw or not req.raw.strip():
            raise HTTPException(
                status_code=400,
                detail="'raw' field cannot be empty"
            )
        
        # Auto-generate mapped (slug) from raw
        raw_value = req.raw.strip()
        mapped_value = generate_slug(raw_value)
        
        # Use "technologies" as datapoint for skills
        datapoint = "technologies"
        
        db = SessionLocal()
        try:
            # Check if mapping already exists
            existing = db.query(Mapping).filter(
                Mapping.datapoint == datapoint,
                Mapping.raw == raw_value
            ).first()
            
            if existing:
                # If exists, return existing mapping
                return {
                    "message": "Mapping already exists",
                    "id": existing.id,
                    "datapoint": existing.datapoint,
                    "raw": existing.raw,
                    "mapped": existing.mapped
                }
            else:
                # Create new mapping
                new_mapping = Mapping(
                    datapoint=datapoint,
                    raw=raw_value,
                    mapped=mapped_value
                )
                db.add(new_mapping)
                db.commit()
                db.refresh(new_mapping)
                return {
                    "message": "Mapping created successfully",
                    "id": new_mapping.id,
                    "datapoint": new_mapping.datapoint,
                    "raw": new_mapping.raw,
                    "mapped": new_mapping.mapped
                }
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Database error",
                    "message": str(e),
                    "type": type(e).__name__,
                }
            )
        finally:
            db.close()
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": str(e),
                "type": type(e).__name__,
            }
        )


def run_coresignal(payload: dict, scheduler_id: int):
    req = CoreSignalRequest(**payload, scheduler_id=str(scheduler_id))
    
    # Read existing jobs to prevent duplicates
    jobs = read_jobs_from_csv()
    existing_ids = {job["id"] for job in jobs}
    
    logic_normalized = req.logic.lower().strip() if req.logic else "or"
    
    job_details_list, duplicates = coresignal.fetch_jobs_with_details(
        city=req.city,
        country=req.country,
        skills=req.skills,
        logic=logic_normalized,
        limit=req.limit,
        existing_job_ids=existing_ids,
        return_duplicates=True
    )
    
    saved_count = save_jobs_to_csv(job_details_list, scheduler_id=req.scheduler_id)
    
    # Update duplicates with new scheduler id
    if duplicates and req.scheduler_id:
        update_job_scheduler_id(duplicates, req.scheduler_id)
        
    return {
        "message": "Completed Successfully",
        "jobs": job_details_list,  # Return original list for compatibility
        "count": saved_count,  # But use saved count
        "updated_duplicates": len(duplicates)
    }

def run_theirstack(payload: dict, scheduler_id: int):
    print(f"DEBUG run_theirstack: Received payload: {payload}")
    
    # Map frontend field names to backend field names
    mapped_payload = payload.copy()
    
    # Map location_pattern -> city
    if "location_pattern" in mapped_payload:
        mapped_payload["city"] = mapped_payload.pop("location_pattern")
    
    # Map job_country_code_or -> country
    if "job_country_code_or" in mapped_payload:
        mapped_payload["country"] = mapped_payload.pop("job_country_code_or")
    
    # Map job_technology_slug -> skills
    if "job_technology_slug" in mapped_payload:
        mapped_payload["skills"] = mapped_payload.pop("job_technology_slug")
    
    req = TheirStackJobRequest(**mapped_payload, scheduler_id=scheduler_id)
    print(f"DEBUG run_theirstack: Parsed request - city={req.city}, country={req.country}, skills={req.skills}")
    
    # Validate that at least city or country is provided
    has_city = req.city and len(req.city) > 0 and any(c.strip() for c in req.city)
    has_country = req.country and len(req.country) > 0 and any(c.strip() for c in req.country)
    if not has_city and not has_country:
        raise ValueError("At least one of 'city' or 'country' must be provided")

    jobs = theirstack.fetch_theirstack_jobs(
        limit=int(req.limit),
        max_age_days=int(req.max_age_days),
        city=req.city,
        country=req.country,
        employment_statuses=req.employment_statuses,
        skills=req.skills,
        logic=req.logic
    )
    print(f"DEBUG run_theirstack: Returning {len(jobs)} jobs")
    return jobs
def run_mantiks(payload: dict, scheduler_id: int):
    req = MantiksJobRequest(**payload)

    jobs = mantiks.fetch_mantiks_jobs(
        limit=req.limit,
        job_age_in_days=req.job_age_in_days,
        job_location_ids=req.job_location_ids,
        job_description=req.job_description,
        #job_title=req.job_title,
        logic=req.logic
    )

    return jobs

API_EXECUTORS = {
    "coresignal": run_coresignal,
    "theirstack": run_theirstack,
    "mantiks": run_mantiks,
}
    

def execute_scheduler_job(scheduler_id: int, api_name: str, payload: dict):
    """
    Execute a scheduler job and return structured results with error handling.
    Also logs the execution to SchedulerRun table.
    
    Returns:
        dict with keys:
            - jobs_count: number of jobs fetched
            - jobs: list of jobs
            - has_error: boolean indicating if an error occurred
            - error_type: type of error if any ("api_error", "network_error", "validation_error", "unknown_error")
            - error_message: human-readable error message
            - error_details: additional error context
    """
    import time
    start_time = time.time()
    if api_name not in API_EXECUTORS:
        return {
            "jobs_count": 0,
            "jobs": [],
            "has_error": True,
            "error_type": "validation_error",
            "error_message": f"Unsupported API: {api_name}",
            "error_details": {"supported_apis": list(API_EXECUTORS.keys())}
        }

    try:
        result = API_EXECUTORS[api_name](
            payload=payload,
            scheduler_id=scheduler_id
        )
    except ValueError as e:
        # Validation errors (e.g., missing required parameters)
        return {
            "jobs_count": 0,
            "jobs": [],
            "has_error": True,
            "error_type": "validation_error",
            "error_message": str(e),
            "error_details": {"exception_type": "ValueError"}
        }
    except requests.exceptions.Timeout as e:
        # Network timeout errors
        return {
            "jobs_count": 0,
            "jobs": [],
            "has_error": True,
            "error_type": "network_error",
            "error_message": f"Request timed out: {str(e)}",
            "error_details": {"exception_type": "Timeout", "api": api_name}
        }
    except requests.exceptions.ConnectionError as e:
        # Network connection errors
        return {
            "jobs_count": 0,
            "jobs": [],
            "has_error": True,
            "error_type": "network_error",
            "error_message": f"Connection error: {str(e)}",
            "error_details": {"exception_type": "ConnectionError", "api": api_name}
        }
    except requests.exceptions.RequestException as e:
        # Other network/request errors
        return {
            "jobs_count": 0,
            "jobs": [],
            "has_error": True,
            "error_type": "network_error",
            "error_message": f"Network error: {str(e)}",
            "error_details": {"exception_type": "RequestException", "api": api_name}
        }
    except Exception as e:
        # Extract error message and try to determine error type
        error_message = str(e)
        error_type = "unknown_error"
        error_details = {"exception_type": type(e).__name__, "api": api_name}
        
        # Try to detect API-specific errors
        if "API" in error_message and ("Error" in error_message or "error" in error_message.lower()):
            error_type = "api_error"
            # Try to extract status code if present
            if "status_code" in error_message or "status code" in error_message.lower():
                import re
                status_match = re.search(r'(\d{3})', error_message)
                if status_match:
                    status_code = int(status_match.group(1))
                    error_details["status_code"] = status_code
                    if status_code == 429:
                        error_details["rate_limit"] = True
        elif "rate limit" in error_message.lower() or "429" in error_message:
            error_type = "api_error"
            error_details["rate_limit"] = True
        elif "timeout" in error_message.lower():
            error_type = "network_error"
        
        # Calculate execution time even for errors
        execution_time = int(time.time() - start_time)
        
        # Log the failed execution
        try:
            create_scheduler_run(
                scheduler_id=scheduler_id,
                jobs_fetched=0,
                has_error=True,
                error_message=error_message,
                execution_time_seconds=execution_time
            )
        except Exception as e:
            print(f"Warning: Failed to log scheduler run for {scheduler_id}: {e}")
        
        return {
            "jobs_count": 0,
            "jobs": [],
            "has_error": True,
            "error_type": error_type,
            "error_message": error_message,
            "error_details": error_details
        }

    jobs = []
    # Handle API response types
    if isinstance(result, dict) and "jobs" in result:
        # CoreSignal returns dict and saves internally
        jobs = result["jobs"]
        saved_count = result.get("count", len(jobs))  # Use count from result (actual saved), fallback to len
    elif isinstance(result, list):
        # Other APIs return list and need saving
        jobs = result
        print(f"DEBUG execute_scheduler_job: Received {len(jobs)} jobs from {api_name}")
        if jobs:
            # Add scheduler_id and save
            for job in jobs:
                job["scheduler_id"] = str(scheduler_id)
            print(f"DEBUG execute_scheduler_job: Saving {len(jobs)} jobs to database with scheduler_id {scheduler_id}")
            saved_count = save_jobs_to_csv(jobs, str(scheduler_id))
            print(f"DEBUG execute_scheduler_job: Successfully saved {saved_count} jobs to database (received {len(jobs)}, {len(jobs) - saved_count} duplicates)")
        else:
            saved_count = 0

    # Calculate execution time
    execution_time = int(time.time() - start_time)
    
    # Log the execution to database with ACTUAL saved count
    try:
        create_scheduler_run(
            scheduler_id=scheduler_id,
            jobs_fetched=saved_count,
            has_error=False,
            execution_time_seconds=execution_time
        )
    except Exception as e:
        print(f"Warning: Failed to log scheduler run for {scheduler_id}: {e}")

    # Success case - no error, but might have 0 jobs (valid empty result)
    return {
        "jobs_count": saved_count,
        "jobs": jobs,
        "has_error": False
    }

def scheduler_checker_thread():
    """
    Background thread that periodically checks for due schedulers and runs them.
    Runs every 5 minutes (300 seconds).
    """
    print("🔄 Scheduler checker thread started - checking every 5 minutes")
    
    while True:
        try:
            # Check for due schedulers
            run_due_schedulers()
        except Exception as e:
            print(f"❌ Error in scheduler checker thread: {e}")
            import traceback
            traceback.print_exc()
        
        # Sleep for 5 minutes (300 seconds) before next check
        time.sleep(300)  # 5 minutes


def start_scheduler_checker_thread():
    """
    Start the background thread to check and run due schedulers.
    This thread runs continuously and checks every 5 minutes.
    """
    try:
        thread = threading.Thread(
            target=scheduler_checker_thread,
            daemon=True,  # Daemon thread will stop when main process exits
            name="SchedulerChecker"
        )
        thread.start()
        print("✅ Background scheduler checker thread started successfully")
    except Exception as e:
        print(f"❌ Failed to start scheduler checker thread: {e}")
        import traceback
        traceback.print_exc()

def run_due_schedulers():
    """Run all due schedulers - should be called periodically (e.g., via cron or background task)"""
    db = SessionLocal()
    try:
        now = datetime.utcnow()

        schedulers = db.query(Scheduler).filter(
            Scheduler.is_active == True,
            Scheduler.next_run <= now
        ).all()

        if not schedulers:
            # No due schedulers, nothing to do
            return

        print(f"🔄 Found {len(schedulers)} due scheduler(s) to run")

        for s in schedulers:
            try:
                print(f"⏰ Running scheduler {s.scheduler_id} ({s.api_name})...")
                result = execute_scheduler_job(
                    scheduler_id=s.scheduler_id,
                    api_name=s.api_name,
                    payload=json.loads(s.payload_json)
                )
                
                # Update scheduler next_run time
                s.last_run = now
                s.next_run = now + timedelta(seconds=s.interval_seconds)
                
                if result.get('has_error'):
                    print(f"⚠️  Scheduler {s.scheduler_id} completed with error: {result.get('error_message')}")
                else:
                    print(f"✅ Scheduler {s.scheduler_id} executed: {result.get('jobs_count', 0)} jobs fetched")
                    
            except Exception as e:
                print(f"❌ Scheduler {s.scheduler_id} failed: {e}")
                import traceback
                traceback.print_exc()
                # Log the error
                try:
                    create_scheduler_run(
                        scheduler_id=s.scheduler_id,
                        jobs_fetched=0,
                        has_error=True,
                        error_message=str(e)
                    )
                except:
                    pass

        db.commit()
        print(f"✅ Completed checking due schedulers")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error in run_due_schedulers: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

@app.post("/api/scheduler/create")
def create_scheduler(req: SchedulerRequest,current_user = Depends(require_admin)):
    ALLOWED_INTERVALS = {
        "1hr": 3600,
        "2hr": 7200,
        "4hr": 14400,
        "6hr": 21600,
        "12hr": 43200,
        "daily": 86400,
        "weekly": 604800,
        "monthly": 2592000,
    }

    interval = req.interval.lower()
    if interval not in ALLOWED_INTERVALS:
        raise HTTPException(400, "Invalid interval")

    now = datetime.utcnow()
    next_run = now + timedelta(seconds=ALLOWED_INTERVALS[interval])

    db = SessionLocal()
    try:
        # Extract commonly accessed fields from payload for easier querying
        job_title_str = None
        skills_str = None
        location_str = None
        limit_val = None
        
        if isinstance(req.payload, dict):
            # Extract skills/keywords
            if "skills" in req.payload:
                skills_val = req.payload["skills"]
                if isinstance(skills_val, list):
                    skills_str = ", ".join(skills_val)
                elif isinstance(skills_val, str):
                    skills_str = skills_val
            elif "job_description" in req.payload:  # Mantiks uses job_description
                skills_val = req.payload["job_description"]
                if isinstance(skills_val, list):
                    skills_str = ", ".join(skills_val)
            
            # Extract location
            if "city" in req.payload:
                location_str = req.payload["city"]
            elif "location_pattern" in req.payload:
                location_val = req.payload["location_pattern"]
                if isinstance(location_val, list):
                    location_str = ", ".join(location_val)
                elif isinstance(location_val, str):
                    location_str = location_val
            
            # Extract limit
            if "limit" in req.payload:
                limit_val = req.payload["limit"]
        
        # Create scheduler with new fields
        # Note: If columns don't exist, migration will add them on next startup
        # For now, we'll try to set them - if they fail, the migration will fix it
        scheduler = Scheduler(
            api_name=req.api_name.lower(),
            payload_json=json.dumps(req.payload),
            interval_type=interval,
            interval_seconds=ALLOWED_INTERVALS[interval],
            next_run=next_run,
            is_active=True,
            created_at=now,
            #job_title=job_title_str,
            skills=skills_str,
            location=location_str,
            limit_value=limit_val
        )
        db.add(scheduler)
        db.commit()
        db.refresh(scheduler)  # ✅ GET scheduler_id FROM DB
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        db.close()

    # 🔥 Immediate execution with timeout (non-blocking if takes too long)
    # Try to execute quickly, but return fast if it takes more than 15 seconds
    MAX_EXECUTION_TIME = 15  # seconds
    
    # Use threading with result sharing
    result_container = {"result": None, "completed": False}
    
    def run_initial_execution():
        """Run execution and store result"""
        try:
            result = execute_scheduler_job(
                scheduler_id=scheduler.scheduler_id,
                api_name=req.api_name.lower(),
                payload=req.payload
            )
            result_container["result"] = result
            result_container["completed"] = True
            
            # Log the result for debugging
            if result.get("has_error"):
                print(f"Execution error for scheduler {scheduler.scheduler_id}: {result.get('error_message')}")
            else:
                print(f"Execution completed for scheduler {scheduler.scheduler_id}: {result.get('jobs_count')} jobs fetched")
        except Exception as e:
            print(f"Error in execution for scheduler {scheduler.scheduler_id}: {str(e)}")
            result_container["result"] = {
                "jobs_count": 0,
                "has_error": True,
                "error_type": "unknown_error",
                "error_message": str(e)
            }
            result_container["completed"] = True
    
    # Start execution in background thread
    execution_thread = threading.Thread(target=run_initial_execution, daemon=True)
    execution_thread.start()
    
    # Wait up to MAX_EXECUTION_TIME seconds for completion
    execution_thread.join(timeout=MAX_EXECUTION_TIME)
    
    if result_container["completed"]:
        # Got result within timeout - return it
        immediate_result = result_container["result"]
        jobs_count = immediate_result.get("jobs_count", 0)
        has_error = immediate_result.get("has_error", False)
        error_type = immediate_result.get("error_type")
        error_message = immediate_result.get("error_message")
        error_details = immediate_result.get("error_details")
        
        # Determine response message and status
        if has_error:
            message = "Scheduler created but initial execution failed"
            success = False
        elif jobs_count == 0:
            message = "Scheduler created but no jobs found"
            success = True
            warning = "No matching jobs found for the given criteria"
        else:
            message = "Scheduler created and executed successfully"
            success = True
            warning = None
        
        response = {
            "success": success,
            "scheduler_id": str(scheduler.scheduler_id),
            "message": message,
            "jobs_fetched": jobs_count,
            "initial_jobs_fetched": jobs_count,
            "has_error": has_error,
            "next_run": next_run.isoformat() if isinstance(next_run, datetime) else next_run,
            "api_name": req.api_name.lower(),
            "execution_status": "completed"
        }
        
        # Add error information if present
        if has_error:
            response["error_type"] = error_type
            response["error_message"] = error_message
            if error_details:
                response["error_details"] = error_details
        
        # Add warning if present
        if not has_error and jobs_count == 0:
            response["warning"] = warning
        
        return response
    else:
        # Execution still running - return immediately and let it continue in background
        print(f"Scheduler {scheduler.scheduler_id} initial execution taking longer than {MAX_EXECUTION_TIME}s, continuing in background")
        
        response = {
            "success": True,
            "scheduler_id": str(scheduler.scheduler_id),
            "message": "Scheduler created successfully. Initial execution started in background.",
            "jobs_fetched": 0,
            "initial_jobs_fetched": 0,
            "has_error": False,
            "next_run": next_run.isoformat() if isinstance(next_run, datetime) else next_run,
            "api_name": req.api_name.lower(),
            "execution_status": "running",
            "warning": "Initial execution is running in the background and may take a few minutes. Check scheduler status or job results after completion."
        }
        
        return response


@app.get("/api/schedulers")
def get_all_schedulers_api(limit: int = 10, offset: int = 0, current_user = Depends(require_viewer)):
    """Return all schedulers in the CSV for UI display."""
    return get_all_schedulers(limit=limit, offset=offset)


@app.delete("/api/scheduler/{scheduler_id}")
def api_delete_scheduler(scheduler_id: str, current_user = Depends(require_admin)):
    """Delete a scheduler - Admin only"""
    return delete_scheduler(scheduler_id)


@app.post("/api/scheduler/{scheduler_id}/start")
def start_scheduler_api(scheduler_id: str, current_user = Depends(require_admin)):
    """Start/activate a scheduler - Admin only"""
    try:
        return start_scheduler(scheduler_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scheduler/{scheduler_id}/stop")
def stop_scheduler_api(scheduler_id: str, current_user = Depends(require_admin)):
    """Stop/deactivate a scheduler - Admin only"""
    try:
        return stop_scheduler(scheduler_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scheduler/{scheduler_id}/runs")
def get_scheduler_runs_api(scheduler_id: str, limit: int = 10, current_user = Depends(require_viewer)):
    """Get execution history for a scheduler"""
    try:
        scheduler_id_int = int(scheduler_id)
        runs = get_scheduler_runs(scheduler_id_int, limit)
        return {
            "scheduler_id": scheduler_id,
            "runs": runs,
            "count": len(runs)
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid scheduler_id")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scheduler-runs/{run_id}/jobs")
def get_scheduler_run_jobs_api(run_id: int, current_user = Depends(require_viewer)):
    """Get all jobs fetched during a specific scheduler run"""
    try:
        result = get_jobs_for_scheduler_run(run_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.put("/api/scheduler/{scheduler_id}/update")
def update_scheduler_payload_api(
    scheduler_id: str,
    req: UpdateSchedulerPayloadRequest,
    current_user = Depends(require_admin),
):
    ALLOWED_INTERVALS = {
        "1hr": 3600,
        "2hr": 7200,
        "4hr": 14400,
        "6hr": 21600,
        "12hr": 43200,
        "daily": 86400,
        "weekly": 604800,
        "monthly": 2592000,
    }

    db = SessionLocal()
    try:
        scheduler = db.query(Scheduler).filter(Scheduler.scheduler_id == int(scheduler_id)).first()
        if not scheduler:
            raise HTTPException(status_code=404, detail="Scheduler not found")

        current_payload = json.loads(scheduler.payload_json) if scheduler.payload_json else {}
        api_name = (scheduler.api_name or "").lower()

        # ---- limit ----
        if req.limit is not None:
            current_payload["limit"] = int(req.limit)
            scheduler.limit_value = int(req.limit)

        # ---- interval ----
        if req.interval is not None:
            interval = req.interval.lower().strip()
            if interval not in ALLOWED_INTERVALS:
                raise HTTPException(status_code=400, detail="Invalid interval")

            scheduler.interval_type = interval
            scheduler.interval_seconds = ALLOWED_INTERVALS[interval]
            scheduler.next_run = datetime.utcnow() + timedelta(seconds=ALLOWED_INTERVALS[interval])

        # ---- skills ----
        if req.skills is not None:
            if not isinstance(req.skills, list):
                raise HTTPException(status_code=400, detail="skills must be a list of strings")

            skills_list = [str(s).strip() for s in req.skills if str(s).strip()]
            scheduler.skills = ", ".join(skills_list) if skills_list else None

            if api_name == "coresignal":
                current_payload["skills"] = skills_list
            elif api_name == "theirstack":
                # keep payload_json key consistent with your TheirStack flow
                current_payload["job_technology_slug"] = skills_list
            elif api_name == "mantiks":
                current_payload["job_description"] = skills_list
            else:
                current_payload["skills"] = skills_list

        # ---- location (api-specific) ----
        if api_name == "coresignal":
            if req.city is not None:
                current_payload["city"] = req.city
            if req.country is not None:
                current_payload["country"] = req.country

            loc_parts = []
            if current_payload.get("city"):
                loc_parts.append(str(current_payload["city"]))
            if current_payload.get("country"):
                loc_parts.append(str(current_payload["country"]))
            scheduler.location = ", ".join(loc_parts) if loc_parts else None

        elif api_name == "theirstack":
            if req.location_pattern is not None:
                current_payload["location_pattern"] = req.location_pattern
            if req.job_country_code_or is not None:
                current_payload["job_country_code_or"] = req.job_country_code_or

            # store something readable in scheduler.location
            if current_payload.get("location_pattern"):
                lp = current_payload["location_pattern"]
                scheduler.location = ", ".join(lp) if isinstance(lp, list) else str(lp)
            elif current_payload.get("job_country_code_or"):
                cc = current_payload["job_country_code_or"]
                scheduler.location = ", ".join(cc) if isinstance(cc, list) else str(cc)
            else:
                scheduler.location = None

        elif api_name == "mantiks":
            if req.job_location_ids is not None:
                current_payload["job_location_ids"] = req.job_location_ids

            ids = current_payload.get("job_location_ids") or []
            scheduler.location = ", ".join([str(x) for x in ids]) if isinstance(ids, list) and ids else None

        # save payload_json
        scheduler.payload_json = json.dumps(current_payload)

        db.commit()
        db.refresh(scheduler)

        return {
            "message": "Scheduler updated",
            "scheduler_id": scheduler.scheduler_id,
            "interval_type": scheduler.interval_type,
            "limit_value": scheduler.limit_value,
            "skills": scheduler.skills,
            "location": scheduler.location,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.get("/api/theirstack/credits")
def get_theirstack_credits(current_user = Depends(require_viewer)):
    """Get TheirStack API credits remaining"""
    import os
    from pathlib import Path
    from dotenv import load_dotenv
    
    try:
        # Load environment variables
        backend_dir = Path(__file__).resolve().parent
        env_path = backend_dir / ".env"
        load_dotenv(dotenv_path=env_path)
        
        API_KEY = os.getenv('THEIRSTACK_API_KEY')
        
        if not API_KEY:
            raise HTTPException(
                status_code=400,
                detail="THEIRSTACK_API_KEY not found in environment variables"
            )
        
        url = "https://api.theirstack.com/v0/billing/credit-balance"
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"TheirStack API error: {response.text[:500]}"
            )
        
        data = response.json()
        credit_used = data.get("used_api_credits", 0)
        total_credits = data.get("api_credits", 0)
        credits_remaining = total_credits - credit_used
        
        return {
            "credits_remaining": credits_remaining,
            "credits_used": credit_used,
            "credits_total": total_credits,
            "api_name": "theirstack"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching TheirStack credits: {str(e)}"
        )


@app.get("/api/mantiks/credits")
def get_mantiks_credits(current_user = Depends(require_viewer)):
    """Get Mantiks API credits from database"""
    try:
        db = SessionLocal()
        try:
            credits_record = db.query(ApiCredits).filter(ApiCredits.api_name == "mantiks").first()
            
            if not credits_record:
                return {
                    "credits_remaining": None,
                    "credits_used": None,
                    "credits_total": 50,
                    "api_name": "mantiks",
                    "message": "No credits data found. Credits will be updated after next Mantiks job fetch."
                }
            
            return {
                "credits_remaining": credits_record.credits_remaining,
                "credits_total": 50,
                "credits_used": 50 - credits_record.credits_remaining,
                "api_name": "mantiks",
                "last_updated": credits_record.last_updated.isoformat() if credits_record.last_updated else None
            }
        finally:
            db.close()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching Mantiks credits: {str(e)}"
        )


@app.get("/api/coresignal/credits")
def get_coresignal_credits(current_user = Depends(require_viewer)):
    """Get CoreSignal API credits from database (both search and collect credits)"""
    try:
        db = SessionLocal()
        try:
            # Get search credits
            search_credits = db.query(ApiCredits).filter(ApiCredits.api_name == "coresignal_search").first()
            # Get collect credits
            collect_credits = db.query(ApiCredits).filter(ApiCredits.api_name == "coresignal_collect").first()
            
            result = {
                "api_name": "coresignal",
                "search_credits_remaining": None,
                "collect_credits_remaining": None,
                "search_last_updated": None,
                "collect_last_updated": None
            }
            
            if search_credits:
                result["search_credits_remaining"] = search_credits.credits_remaining
                result["search_last_updated"] = search_credits.last_updated.isoformat() if search_credits.last_updated else None
            
            if collect_credits:
                result["collect_credits_remaining"] = collect_credits.credits_remaining
                result["collect_last_updated"] = collect_credits.last_updated.isoformat() if collect_credits.last_updated else None
            
            # If no credits found at all
            if not search_credits and not collect_credits:
                result["message"] = "No credits data found. Credits will be updated after next CoreSignal job fetch."
            
            return result
        finally:
            db.close()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching CoreSignal credits: {str(e)}"
        )

# Add after the CoreSignal credits endpoint (around line 2826)

@app.get("/api/sovren/credits")
def get_sovren_credits(current_user = Depends(require_viewer)):
    """Get Sovren API credits from database"""
    try:
        db = SessionLocal()
        try:
            credits_record = db.query(ApiCredits).filter(ApiCredits.api_name == "sovren").first()
            
            if not credits_record:
                return {
                    "credits_remaining": None,
                    "api_name": "sovren",
                    "message": "No credits data found. Credits will be updated after next Sovren API call."
                }
            
            return {
                "credits_remaining": credits_record.credits_remaining,
                "api_name": "sovren",
                "last_updated": credits_record.last_updated.isoformat() if credits_record.last_updated else None
            }
        finally:
            db.close()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching Sovren credits: {str(e)}"
        )

# login and signup
# Authentication routes
from auth.router import router as auth_router
app.include_router(auth_router)

