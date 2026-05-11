import os
import requests
from dotenv import load_dotenv
from .sovren_parser import parse_job_description_from_string

# Load environment variables
load_dotenv()

# Get API key from environment variable
MANTIKS_API_KEY = os.getenv('MANTIKS_API_KEY', '')
BASE_URL = "https://api.mantiks.io"

# Optional OpenAI configuration for GPT-based skill parsing (e.g., gpt-5.1)
_openai_api_key = os.getenv("OPENAI_API_KEY", "")
_openai_model = os.getenv("OPENAI_SKILL_MODEL", "gpt-4o")  # set OPENAI_SKILL_MODEL=gpt-5.1 to use gpt-5.1


def _extract_skills_with_llm(description: str):
    """
    Extract technical skills from a raw job description using an LLM (GPT).
    Uses the same model as the skill classifier (OPENAI_SKILL_MODEL, e.g. gpt-5.1).
    Returns a list of lowercased skill keywords.
    """
    if not description or not description.strip():
        return []

    if not _openai_api_key or not _openai_api_key.strip():
        # OpenAI not configured – no-op
        return []

    try:
        from openai import OpenAI
        import json as _json

        client = OpenAI(api_key=_openai_api_key)
        prompt = f"""You are a job-description skill extractor.

Extract ONLY concrete technical skills from the following job description.

Job Description:
\"\"\"{description[:8000]}\"\"\"  # truncated for safety

Return a JSON object with one key "skills" whose value is an array of lowercase strings.
Include ONLY:
- Programming languages (e.g. python, java, c#, javascript, typescript, go, rust, etc.)
- Frameworks and libraries (e.g. .net, spring boot, django, react, vue, angular, node.js, etc.)
- Databases and data stores (e.g. mysql, postgresql, mongodb, redis, elasticsearch, etc.)
- Cloud / DevOps / tools (e.g. aws, azure, gcp, docker, kubernetes, terraform, jenkins, git, ci/cd, openshift, webservices, rest, graphql, shopify, etc.)
- Short methodologies (e.g. agile, scrum, prince 2).

EXCLUDE completely (do not list at all):
- Soft skills (communication, teamwork, leadership, negotiation, coaching, etc.)
- Generic phrases (results oriented, customer focused, people management, best practices, governance, etc.)
- Company culture, benefits, HR terms.

Return ONLY valid JSON like:
{{"skills": ["java", "jee", "openshift", "webservices", ".net"]}}"""

        response = client.chat.completions.create(
            model=_openai_model,
            messages=[
                {
                    "role": "system",
                    "content": "You output only valid JSON with a 'skills' array of technical keywords, all lowercase."
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=1024,
        )

        output_text = response.choices[0].message.content.strip()

        # Best-effort JSON parse
        try:
            parsed = _json.loads(output_text)
        except _json.JSONDecodeError:
            # Try to locate the JSON object inside the text
            start = output_text.find("{")
            end = output_text.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    parsed = _json.loads(output_text[start : end + 1])
                except _json.JSONDecodeError:
                    return []
            else:
                return []

        skills = parsed.get("skills", []) if isinstance(parsed, dict) else []
        cleaned = []
        for s in skills:
            if not s:
                continue
            val = str(s).strip().lower()
            if not val:
                continue
            cleaned.append(val)

        return cleaned
    except Exception as e:
        print(f"Mantiks: LLM skill extraction failed: {e}")
        return []


def fetch_mantiks_jobs(
    *,
    limit: int = 1,
    job_age_in_days: int = 90,
    job_location_ids: list[int],
    job_description: list[str] | None = None,
    logic: str = "or",
    offset: str | None = None,
):
    """
    Fetch companies and their jobs from Mantiks API using /company/search endpoint.
    
    Mantiks is company-first:
    - credits consumed per company
    - jobs are grouped per company
    
    Args:
        limit: Maximum number of companies to fetch (NOT jobs - each company can have multiple jobs)
        job_age_in_days: Maximum age of jobs in days
        job_location_ids: List of location IDs (REQUIRED) - use location/search endpoint to get IDs
        job_description: Optional list of keywords to search in job descriptions
        logic: "or" or "and" - controls how job_description keywords are matched (OR = any keyword, AND = all keywords)
        offset: Optional pagination offset
    
    Returns:
        List of job detail dictionaries in standardized format matching CSV_FIELDS
    """
    
    if not job_location_ids:
        raise ValueError("job_location_ids is required and cannot be empty")

    headers = {
        "x-api-key": MANTIKS_API_KEY,
        "accept": "application/json",
    }

    # REQUIRED PARAMS for /company/search endpoint
    params = {
        "limit": limit,
        "job_age_in_days": job_age_in_days,
        "job_location_ids": job_location_ids,
        "job_description" : job_description
        }

    # Normalize logic
    logic_normalized = logic.lower().strip() if logic else "or"
    if logic_normalized not in ["or", "and"]:
        raise ValueError("Logic parameter must be either 'or' or 'and'")
    
    # Add job_description filter if provided (for skills/keywords filtering)
    if job_description:
        params["job_description"] = job_description
        # Mantiks API supports AND logic via job_description_include_all parameter
        if logic_normalized == "and":
            params["job_description_include_all"] = True
            print(f"Mantiks skills logic: AND (job must have all: {job_description})")
        else:
            print(f"Mantiks skills logic: OR (job must have any: {job_description})")

    if offset:
        params["offset"] = offset

    try:
        response = requests.get(
            f"{BASE_URL}/company/search",
            headers=headers,
            params=params,
            timeout=30,
        )
    except requests.exceptions.ConnectionError as e:
        error_msg = f"Failed to connect to Mantiks API. Check network connectivity and DNS resolution."
        error_msg += f"\nError: {str(e)}"
        error_msg += f"\nURL: {BASE_URL}/company/search"
        raise Exception(error_msg)
    except requests.exceptions.Timeout as e:
        error_msg = f"Mantiks API request timed out after 30 seconds."
        raise Exception(error_msg)
    except requests.exceptions.RequestException as e:
        error_msg = f"Network error connecting to Mantiks API: {str(e)}"
        raise Exception(error_msg)

    if response.status_code != 200:
        error_msg = f"Mantiks API Error: {response.status_code}"
        try:
            error_data = response.json()
            error_msg += f"\nError Details: {error_data}"
        except:
            error_msg += f"\nResponse Text: {response.text}"
        error_msg += f"\nParams Sent: {params}"
        raise Exception(error_msg)

    data = response.json()
    
    jobs_list = []

    credit = data.get("credits_remaining")
    
    # Save credits to database
    try:
        from database.mysql import SessionLocal
        from database.models.api_credits import ApiCredits
        from datetime import datetime
        db = SessionLocal()
        try:
            # Get or create Mantiks credits record
            credits_record = db.query(ApiCredits).filter(ApiCredits.api_name == "mantiks").first()
            if credits_record:
                credits_record.credits_remaining = credit
                credits_record.last_updated = datetime.utcnow()
            else:
                credits_record = ApiCredits(
                    api_name="mantiks",
                    credits_remaining=credit
                )
                db.add(credits_record)
            db.commit()
        except Exception as e:
            print(f"Error saving Mantiks credits to database: {e}")
            db.rollback()
        finally:
            db.close()
    except Exception as e:
        print(f"Error connecting to database to save Mantiks credits: {e}")
    
    job_counter = 0  # Track total jobs collected

    # Iterate through companies and extract all jobs
    for company in data.get("companies", []):
        company_name = company.get("name", "")
        company_website = company.get("website", "")
        company_industry = company.get("industry", "")

        for job in company.get("jobs", []):
            # Parsing Sovren for each job
            parsed_data = {}
            description = job.get("description", "") or ""
            try:
                parsed_data = parse_job_description_from_string(description)
            except Exception as e:
                print("Sovren parsing failed:", e)
            # Generate unique ID for each job (prefix with "mt_" for Mantiks)
            # Use company name + job title + location as base for ID if job ID not available"
            job_id = "mt_" + job.get("job_id")
            
            # Extract salary information
            salary = job.get("salary") or {}
            
            # Extract location and country
            location = job.get("location", "")
            # Try to extract country from location if available
            #country = job.get("country", "")
            
            # getting the city and country from the location 
        
            city = ""
            country = ""

            if location and "(" in location and ")" in location:
                country = location.split("(")[1].replace(")", "").strip()

            # to check email
            try:
                email = parsed_data["Value"]["JobData"]["ApplicationDetails"]["ContactEmail"]
            except:
                print("No Email Found")
                email = None
            
            # Extract skills/keywords - Mantiks might have this in job description or separate field
            
            # Safely extract skills from parsed_data
            skills = []
            try:
                raw_skills = parsed_data.get("Value", {}).get("JobData", {}).get("Skills", {}).get("Raw", [])
                skills = [skill["Name"].lower() for skill in raw_skills if "Name" in skill]
            except Exception as e:
                print(f"Error extracting skills: {e}")

            # Augment / fallback with GPT-based technical skill extraction
            llm_skills = _extract_skills_with_llm(description)
            if llm_skills:
                merged = set(skills)
                for s in llm_skills:
                    if s and isinstance(s, str) and s.strip():
                        merged.add(s.strip().lower())
                skills = sorted(merged)
            
            # Map to standardized format matching CSV_FIELDS:
            # "id", "created_at", "location", "country", "title", "description",
            # "seniority", "job_url", "company_name", "company_website",
            # "company_industry", "company_keywords", "email"
            job_data = {
                "id": job_id,#
                "created_at": job.get("date_creation", ""),#
                "location": location,  # Full location string#
                "country": location,  # Extracted country#
                "title": job.get("job_title", ""),#
                "description": description,
                "job_url": job.get("job_board_url", ""),
                "job_type":job.get("job_type",""),
                "company_name": company_name,
                "company_website": company_website,
                "company_industry": company_industry,
                "Skills": skills,  # Sovren + GPT skills
                "email": email, # Mantiks doesn't seem to provide email in the response
                "credits_remaining": credit  # Credits remaining from Mantiks API
            }
            
            jobs_list.append(job_data)
            job_counter += 1
            print(jobs_list)
    return jobs_list

# fetch_mantiks_jobs( limit = 1,
#     job_age_in_days = 90,
#     job_location_ids=[1269750],
#     job_title =["python developer"])