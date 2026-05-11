import requests
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from .sovren_parser import parse_job_description_from_string, extract_all_fields_from_parsed_data


# Load environment variables
# Look for .env file in the backend directory (parent of helpers/apis)
backend_dir = Path(__file__).resolve().parent.parent.parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)

# Get API key from environment variable
ACCOUNT_ID = os.getenv('THEIRSTACK_API_KEY', '')

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
        print(f"TheirStack: LLM skill extraction failed: {e}")
        return []


def fetch_theirstack_jobs(
    limit: int,
    max_age_days: int,
    country: list[str]| None,
    city: list[str] | None,
    skills: list[str] | None,
    employment_statuses: list[str] | None,
    logic : str = "or",
    offset: int = 0,              
):
    """
    Fetch jobs from TheirStack API using minimal supported filters.
    """

    url = "https://api.theirstack.com/v1/jobs/search"

    headers = {
        "Authorization": f"Bearer {ACCOUNT_ID}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # ----------------------------
    # Helpers
    # ----------------------------
    def is_valid_str(v):
        return isinstance(v, str) and v.strip().lower() not in {
            "", "none", "null", "undefined", "string"
        }
    
    def normalize_scalar(value):
        """Convert a list to its first valid element, or return None."""
        if isinstance(value, list):
            if not value:
                return None
            first = value[0]
            return first if isinstance(first, str) and first.strip() else None
        return value
    
    def clean_list(lst):
        """Remove empty strings and None values from a list."""
        if not isinstance(lst, list):
            return lst
        cleaned = [item for item in lst if item and isinstance(item, str) and item.strip()]
        return cleaned if cleaned else None

    # ----------------------------
    # Normalize inputs
    # ----------------------------
    city_scalar = normalize_scalar(city)  # City as scalar for pattern matching
    country_cleaned = clean_list(country)  # Country as list (API expects list)
    
    # ----------------------------
    # Build payload
    # ----------------------------
    payload = {
        "limit": limit,
        "posted_at_max_age_days": max_age_days,
        "offset": offset
    }
    
    # Add country filter if valid
    if country_cleaned:
        payload["job_country_code_or"] = country_cleaned
    
    # Add city/location filter if valid
    if is_valid_str(city_scalar):
        payload["job_location_pattern_or"] = [city_scalar.strip()]

    # ----------------------------
    # Skills (technology slugs)
    # ----------------------------
    logic_normalized = logic.lower().strip() if isinstance(logic, str) else "or"
    if logic_normalized not in {"or", "and"}:
        logic_normalized = "or"

    if skills and isinstance(skills, list):
        valid_skills = [s.strip().lower() for s in skills if isinstance(s, str) and s.strip()]
        if valid_skills:
            if logic_normalized == "and":
                payload["job_technology_slug_and"] = valid_skills
            else:
                payload["job_technology_slug_or"] = valid_skills

    # ----------------------------
    # Employment status
    # ----------------------------
    ALLOWED_STATUSES = {
        "full_time", "part_time", "contract",
        "internship", "temporary", "freelance"
    }

    if employment_statuses and isinstance(employment_statuses, list):
        valid_statuses = [s for s in employment_statuses if s in ALLOWED_STATUSES]
        if valid_statuses:
            payload["employment_statuses_or"] = valid_statuses

    # ----------------------------
    # Make API request
    # ----------------------------
    print(f"DEBUG: TheirStack Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
    except requests.exceptions.ConnectionError as e:
        error_msg = f"Failed to connect to TheirStack API. Check network connectivity."
        error_msg += f"\nError: {str(e)}"
        raise Exception(error_msg)
    except requests.exceptions.Timeout as e:
        raise Exception("TheirStack API request timed out after 30 seconds.")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Network error connecting to TheirStack API: {str(e)}")

    # Error handling
    if response.status_code != 200:
        error_msg = f"TheirStack API Error: {response.status_code}"
        try:
            error_data = response.json()
            error_msg += f"\nError Details: {json.dumps(error_data, indent=2)}"
            
            # Check for specific error types
            if response.status_code == 429:
                error_msg += "\nRate limit exceeded. Please wait before making another request."
            elif response.status_code == 401:
                error_msg += "\nAuthentication failed. Check API key."
            elif response.status_code == 403:
                error_msg += "\nAccess forbidden. Check API key permissions."
            elif response.status_code == 400:
                error_msg += "\nInvalid request parameters. Check payload."
        except:
            error_msg += f"\nResponse Text: {response.text[:500]}"  # Limit response text
        error_msg += f"\nPayload Sent: {json.dumps(payload, indent=2)}"
        error_msg += f"\nURL: {url}"
        raise Exception(error_msg)

    response.raise_for_status()

    data = response.json()
    print(f"DEBUG: TheirStack Response - Total: {data.get('total', 0)}, Data count: {len(data.get('data', []))}")
    
    jobs_list = []
    for job in data.get("data", []):
        # Parse job description with Sovren to extract all fields
        description = job.get("description", "")
        parsed_data = {}
        sovren_fields = {
            "skills": [],
            "email": None,
            "job_title": None,
            "company_name": None,
            "location": None,
            "requirements": [],
            "responsibilities": [],
            "experience_level": None,
            "education": [],
            "salary": None,
            "benefits": [],
            "job_type": None,
        }
        
        if description and description.strip():
            try:
                parsed_data = parse_job_description_from_string(description)
                sovren_fields = extract_all_fields_from_parsed_data(parsed_data)
            except Exception as e:
                print(f"TheirStack: Sovren parsing failed for job {job.get('id')}: {e}")

        # Augment / fallback with GPT-based technical skill extraction
        llm_skills = _extract_skills_with_llm(description)

        api_skills = job.get("technology_slugs") or []
        merged_skills = set()
        for s in sovren_fields.get("skills") or []:
            if s and isinstance(s, str) and s.strip():
                merged_skills.add(s.strip().lower())
        for s in api_skills:
            if s and isinstance(s, str) and s.strip():
                merged_skills.add(s.strip().lower())
        for s in llm_skills:
            if s and isinstance(s, str) and s.strip():
                merged_skills.add(s.strip().lower())

        # Use API data first, then override/enhance with Sovren parsed data
        job_data = {
            "id": "ts_" + str(job.get("id")),
            "title": sovren_fields.get("job_title") or job.get("job_title"),
            "company_name": sovren_fields.get("company_name") or job.get("company"),
            "location": sovren_fields.get("location") or job.get("location"),
            "seniority": sovren_fields.get("experience_level") or job.get("seniority"),
            "created_at": job.get("date_posted"),
            "description": description,  # Keep original description
            "job_url": job.get("source_url"),
            "company_website": job.get("company_object", {}).get("url"),
            "country": job.get("country"),
            "employment_status": sovren_fields.get("job_type") or job.get("employment_statuses"),
            # Use Sovren extracted email, fallback to API email
            "email": sovren_fields.get("email") or job.get("email") or "Not Found",
            # Final skills: Sovren + API + GPT merged, normalized
            "skills": sorted(merged_skills),
        }
        
        jobs_list.append(job_data)

    print(f"DEBUG: TheirStack returning {len(jobs_list)} jobs")
    return jobs_list
