import requests
import json
import re
import os
from pathlib import Path
from dotenv import load_dotenv
from .sovren_parser import parse_job_description_from_string, extract_all_fields_from_parsed_data

# Optional OpenAI configuration for GPT-based skill parsing (e.g., gpt-5.1)
_openai_api_key = os.getenv("OPENAI_API_KEY", "")
_openai_model = os.getenv("OPENAI_SKILL_MODEL", "gpt-5.1")  # set OPENAI_SKILL_MODEL=gpt-5.1 to use gpt-5.1

# Load environment variables
# Look for .env file in the backend directory (parent of helpers/apis)
backend_dir = Path(__file__).resolve().parent.parent.parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)

# Get API key from environment variable
CORESIGNAL_API_KEY = os.getenv('CORESIGNAL_API_KEY', '')

headers = {
    'Content-Type': 'application/json',
    'apikey': CORESIGNAL_API_KEY
}

def search_jobs(city=None, country=None, keywords=[], logic="or"):
    """
    Search for jobs in CoreSignal API.
    
    Args:
        city: City name (optional, but at least one of city or country must be provided)
        country: Country name (optional, but at least one of city or country must be provided)
        keywords: List of skills/keywords
        logic: "or" or "and" - controls how skills are matched (OR = any skill, AND = all skills)
    
    Returns:
        API response dictionary
    """
    # Validate that at least one location parameter is provided
    if not city and not country:
        raise ValueError("At least one of 'city' or 'country' must be provided")
    
    # Normalize logic
    logic_normalized = logic.lower().strip() if logic else "or"
    if logic_normalized not in ["or", "and"]:
        raise ValueError("Logic parameter must be either 'or' or 'and'")
    
    url = "https://api.coresignal.com/cdapi/v2/job_multi_source/search/es_dsl"

    # Build location query with robust handling (similar to search_resumes)
    location_must = []
    
    # Handle city parameter - use multi_match across location fields
    if city and city.strip() and city.lower() != "none":
        location_must.append({
            "multi_match": {
                "query": city.split()[0], # Use first word of city for broader matching
                "fields": ["city", "location", "location_full"],
                "type": "best_fields"
            }
        })
        
    # Handle country parameter
    if country and country.strip() and country.lower() != "none":
        location_must.append({
            "match": {
                "country": {
                    "query": country,
                    "fuzziness": 0
                }
            }
        })
    
    # Build skills query with OR/AND logic if keywords are provided
            # ✅ Build skills query (CoreSignal-compatible)
    must_clauses = []
    must_clauses.extend(location_must)    
    
    if keywords:
        skills_query = {
            "bool": {
                "should": [
                    {
                        "multi_match": {
                            "query": keyword,
                            "fields": ["title", "description"],
                            "operator": "and"
                        }
                    }
                    for keyword in keywords
                ],
                # AND → all skills must appear somewhere
                # OR  → any one skill is enough
                "minimum_should_match": len(keywords) if logic_normalized == "and" else 1
            }
        }

        must_clauses.append(skills_query)

        print(f"Skills logic: OR (job must have any: {keywords})")

    # Build the complete query
    
    
    # Add skills query if keywords are provided
    # if skills_query:
    #     must_clauses.append(skills_query)

    payload = json.dumps({
        "query": {
            "bool": {
                "must": must_clauses
            }
        }
    })

    # Debug: print the query being sent
    print(f"Elasticsearch query payload: {payload}")

    try:
        response = requests.request("POST", url, headers=headers, data=payload, timeout=30)
    except requests.exceptions.Timeout as e:
        error_msg = "CoreSignal API request timed out after 30 seconds."
        error_msg += f"\nURL: {url}"
        raise Exception(error_msg)
    except requests.exceptions.ConnectionError as e:
        error_msg = "Failed to connect to CoreSignal API. Check network connectivity."
        error_msg += f"\nError: {str(e)}"
        error_msg += f"\nURL: {url}"
        raise Exception(error_msg)
    except requests.exceptions.RequestException as e:
        error_msg = f"Network error connecting to CoreSignal API: {str(e)}"
        error_msg += f"\nURL: {url}"
        raise Exception(error_msg)
    
    # Check for API errors
    if response.status_code != 200:
        error_msg = f"CoreSignal API Error: {response.status_code}"
        try:
            error_data = response.json()
            error_msg += f"\nError Details: {json.dumps(error_data, indent=2)}"
            
            # Check for rate limit
            if response.status_code == 429:
                error_msg += "\nRate limit exceeded. Please wait before making another request."
            elif response.status_code == 401:
                error_msg += "\nAuthentication failed. Check API key."
            elif response.status_code == 403:
                error_msg += "\nAccess forbidden. Check API key permissions."
        except:
            error_msg += f"\nResponse Text: {response.text[:500]}"  # Limit response text
        error_msg += f"\nURL: {url}"
        raise Exception(error_msg)
    
    try:
        response_dict = response.json()
    except json.JSONDecodeError as e:
        error_msg = f"CoreSignal API returned invalid JSON response."
        error_msg += f"\nResponse Text: {response.text[:500]}"
        error_msg += f"\nStatus Code: {response.status_code}"
        raise Exception(error_msg)
    
    # Debug: print response structure
    print(f"CoreSignal API response type: {type(response_dict)}")
    if isinstance(response_dict, dict):
        print(f"CoreSignal API response keys: {list(response_dict.keys())}")
        if "hits" in response_dict:
            print(f"Number of hits: {len(response_dict.get('hits', []))}")
    elif isinstance(response_dict, list):
        print(f"CoreSignal API returned list with {len(response_dict)} items")
    
    # Save search credits to database
    try:
        from database.mysql import SessionLocal
        from database.models.api_credits import ApiCredits
        from datetime import datetime
        search_headers = dict(response.headers)
        search_credit = None
        
        if 'x-credits-remaining' in search_headers:
            try:
                search_credit = int(search_headers['x-credits-remaining'])
            except (ValueError, TypeError):
                pass
        
        if search_credit is not None:
            db = SessionLocal()
            try:
                # Get or create CoreSignal credits record
                credits_record = db.query(ApiCredits).filter(ApiCredits.api_name == "coresignal_search").first()
                if credits_record:
                    credits_record.credits_remaining = search_credit
                    credits_record.last_updated = datetime.utcnow()
                else:
                    credits_record = ApiCredits(
                        api_name="coresignal_search",
                        credits_remaining=search_credit
                    )
                    db.add(credits_record)
                db.commit()
            except Exception as e:
                print(f"Error saving CoreSignal search credits to database: {e}")
                db.rollback()
            finally:
                db.close()
    except Exception as e:
        print(f"Error connecting to database to save CoreSignal search credits: {e}")
    
    return response_dict

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
        print(f"CoreSignal: LLM skill extraction failed: {e}")
        return []


def safe_sovren_parse(description: str):
    """
    Safely parse job description and return both raw parsed data and extracted fields.
    
    Returns:
        tuple: (parsed_data_dict, extracted_fields_dict)
    """
    if not description or not description.strip():
        empty_fields = {
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
        return {}, empty_fields

    # First try Sovren
    parsed_data = {}
    extracted_fields = {
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

    try:
        parsed_data = parse_job_description_from_string(description)
        extracted_fields = extract_all_fields_from_parsed_data(parsed_data) or extracted_fields
    except Exception as e:
        print(f"CoreSignal: Sovren parsing failed: {e}")

    # If Sovren did not extract any (or very few) skills, or we generally want to
    # enhance skills, use LLM-based extraction and merge results.
    sovren_skills = extracted_fields.get("skills") or []
    llm_skills = _extract_skills_with_llm(description)

    if llm_skills:
        merged = {s.strip().lower() for s in sovren_skills if isinstance(s, str) and s.strip()}
        for s in llm_skills:
            if s not in merged:
                merged.add(s)
        extracted_fields["skills"] = sorted(merged)

    return parsed_data, extracted_fields


def get_job_details(job_id):
    url = f"https://api.coresignal.com/cdapi/v2/job_multi_source/collect/{job_id}"
    
    try:
        response = requests.request("GET", url, headers=headers, timeout=30)
    except requests.exceptions.Timeout as e:
        error_msg = f"CoreSignal API request timed out when fetching job details for ID: {job_id}"
        error_msg += f"\nURL: {url}"
        raise Exception(error_msg)
    except requests.exceptions.ConnectionError as e:
        error_msg = f"Failed to connect to CoreSignal API when fetching job details for ID: {job_id}"
        error_msg += f"\nError: {str(e)}"
        raise Exception(error_msg)
    except requests.exceptions.RequestException as e:
        error_msg = f"Network error fetching job details for ID: {job_id}: {str(e)}"
        raise Exception(error_msg)
    
    # Check for API errors
    if response.status_code != 200:
        error_msg = f"CoreSignal API Error when fetching job details: {response.status_code}"
        try:
            error_data = response.json()
            error_msg += f"\nError Details: {json.dumps(error_data, indent=2)}"
            if response.status_code == 404:
                error_msg += f"\nJob with ID {job_id} not found."
            elif response.status_code == 429:
                error_msg += "\nRate limit exceeded. Please wait before making another request."
        except:
            error_msg += f"\nResponse Text: {response.text[:500]}"
        error_msg += f"\nURL: {url}"
        raise Exception(error_msg)
    
    try:
        response_dict = response.json()
    except json.JSONDecodeError as e:
        error_msg = f"CoreSignal API returned invalid JSON when fetching job details for ID: {job_id}"
        error_msg += f"\nResponse Text: {response.text[:500]}"
        raise Exception(error_msg)

    # Save collect/fetch credits to database
    try:
        from database.mysql import SessionLocal
        from database.models.api_credits import ApiCredits
        from datetime import datetime
        fetch_headers = dict(response.headers)
        fetch_credit = None
        
        if 'x-credits-remaining' in fetch_headers:
            try:
                fetch_credit = int(fetch_headers['x-credits-remaining'])
            except (ValueError, TypeError):
                pass
        
        if fetch_credit is not None:
            db = SessionLocal()
            try:
                # Get or create CoreSignal collect credits record
                credits_record = db.query(ApiCredits).filter(ApiCredits.api_name == "coresignal_collect").first()
                if credits_record:
                    credits_record.credits_remaining = fetch_credit
                    credits_record.last_updated = datetime.utcnow()
                else:
                    credits_record = ApiCredits(
                        api_name="coresignal_collect",
                        credits_remaining=fetch_credit
                    )
                    db.add(credits_record)
                db.commit()
            except Exception as e:
                print(f"Error saving CoreSignal collect credits to database: {e}")
                db.rollback()
            finally:
                db.close()
    except Exception as e:
        print(f"Error connecting to database to save CoreSignal collect credits: {e}")

    description = response_dict.get("description", "")
    
    # Parse job description with Sovren to extract all fields
    parsed_data, sovren_fields = safe_sovren_parse(description)
       
    final_job_id = (
        response_dict.get("id")
        or response_dict.get("job_id")
        or response_dict.get("_id")
        or job_id  # fallback to searched job_id
    )

    # Use API data first, then enhance with Sovren parsed data
    data = {
        "id": "cs_" + str(final_job_id),
        "created_at": response_dict.get("updated_at", ""),
        "location": sovren_fields.get("location") or response_dict.get("location", ""),
        "country": response_dict.get("country", ""),
        "title": sovren_fields.get("job_title") or response_dict.get("title", ""),
        "description": description,  # Keep original description
        "seniority": sovren_fields.get("experience_level") or response_dict.get("seniority", ""),
        "job_url": response_dict.get("external_url", ""),
        "company_name": sovren_fields.get("company_name") or response_dict.get("company_name", ""),
        "company_website": response_dict.get("company_url", ""),
        "company_industry": response_dict.get("company_industry", ""),
        # Use Sovren extracted skills
        "skills": sovren_fields.get("skills", []),
        # Use Sovren extracted email
        "email": sovren_fields.get("email") or "None",
        # Additional fields from Sovren
        "requirements": sovren_fields.get("requirements", []),
        "responsibilities": sovren_fields.get("responsibilities", []),
        "education": sovren_fields.get("education", []),
        "salary": sovren_fields.get("salary"),
        "benefits": sovren_fields.get("benefits", []),
        "job_type": sovren_fields.get("job_type"),
    }
    return data

def fetch_jobs_with_details(city, country, skills, logic, limit, existing_job_ids=set(), return_duplicates=False):
    """
    Search for jobs, filter duplicates, and fetch full details.
    
    Args:
        city: City name
        country: Country name
        skills: List of skills
        logic: "or" or "and"
        limit: Max jobs to fetch
        existing_job_ids: Set of existing job IDs to skip (optional)
        return_duplicates: Whether to return list of duplicate IDs found
    
    Returns:
        List of job detail dictionaries, OR tuple of (job_details, duplicates) if return_duplicates=True
    """
    matching_jobs_response = search_jobs(
        city=city,
        country=country,
        keywords=skills,
        logic=logic,
    )

    # Extract job IDs from the API response
    matching_jobs = []
    if isinstance(matching_jobs_response, list):
        matching_jobs = matching_jobs_response
    elif isinstance(matching_jobs_response, dict):
        if "hits" in matching_jobs_response:
            matching_jobs = [hit.get("_id") or hit.get("id") for hit in matching_jobs_response.get("hits", [])]
        elif "data" in matching_jobs_response:
            matching_jobs = matching_jobs_response.get("data", [])
        elif "results" in matching_jobs_response:
            matching_jobs = matching_jobs_response.get("results", [])
        else:
            for key, value in matching_jobs_response.items():
                if isinstance(value, list) and len(value) > 0:
                    matching_jobs = value
                    break

    # Filter out None values
    matching_jobs = [job_id for job_id in matching_jobs if job_id is not None]

    print(f"Found {len(matching_jobs)} matching jobs from API")
    
    job_details_list = []
    duplicates = []
    added = 0
    skipped = 0

    # Normalize requested skills for comparison
    requested_skills = [str(s).strip().lower() for s in (skills or []) if s and str(s).strip()]
    logic_normalized = (logic or "or").strip().lower()

    def _job_matches_requested_skills(job_skills):
        """Post-filter: ensure job actually matches requested skills based on AND/OR logic."""
        if not requested_skills:
            return True
        if not job_skills:
            return False
        job_skill_set = {str(s).strip().lower() for s in job_skills if s and str(s).strip()}
        if not job_skill_set:
            return False
        if logic_normalized == "and":
            # Job must contain all requested skills
            return all(any(req in js or js in req for js in job_skill_set) for req in requested_skills)
        # OR logic: job must contain at least one requested skill
        return any(any(req in js or js in req for js in job_skill_set) for req in requested_skills)

    for raw_id in matching_jobs:
        if added >= limit:
            break

        if not raw_id:
            continue

        cs_id = f"cs_{raw_id}"

        if cs_id not in existing_job_ids:
            try:
                job_details = get_job_details(raw_id)
                if job_details is None:
                    continue

                # Post-filter using parsed skills (Sovren + GPT fallback)
                job_skills = job_details.get("skills") or []
                if not _job_matches_requested_skills(job_skills):
                    print(f"CoreSignal fetch_jobs_with_details: Skipping job {raw_id} – skills {job_skills} do not satisfy requested {requested_skills} with logic={logic_normalized}")
                    continue

                job_details_list.append(job_details)
                added += 1
            except Exception as e:
                print(f"Error fetching job details for {raw_id}: {str(e)}")
                continue
        else:
            skipped += 1
            if return_duplicates:
                duplicates.append(cs_id)
            
    print(f"Added {added} new jobs, skipped {skipped} duplicates")
    
    if return_duplicates:
        return job_details_list, duplicates
    return job_details_list

def search_resumes(city, formatted_keywords, k, job_title=None, country=None, max_results=100):
    """
    Search for resumes with exact job title, location, country and skills matching.
    
    Args:
        city: Location string (city name)
        formatted_keywords: List of formatted keyword queries
        k: Minimum number of keywords that must match
        job_title: Job title for exact matching (optional)
        country: Country name for filtering (optional)
        max_results: Maximum number of results to return (default: 100)
    
    Returns:
        List of resume dictionaries or empty list on error
    """
    url = "https://api.coresignal.com/cdapi/v2/employee_multi_source/search/es_dsl"
    
    must_clauses = [
        {
            "bool": {
                "should": formatted_keywords,
                "minimum_should_match": k
            }
        },
        {
            "exists": {
                "field": "primary_professional_email"
            }
        }
    ]
    
    # Add location filter if city is provided and not "None"
    if city and city.strip() and city.lower() != "none":
        city_clean = city.strip().split(",")[0].strip()
        if city_clean:
            must_clauses.append({
                "multi_match": {
                    "query": city.split()[0],
                    "fields": [
                        "location_full",
                        "city",
                        "location"
                    ]
                }
        })
        print(f"CoreSignal search - Adding location filter: '{city_clean}' (clean from '{city}')")
    
    # Add country filter if country is provided and not "None"
    # Country is REQUIRED filter (second most important after must skills)
    country_filter_added = False
    if country and country.strip() and country.lower() != "none":
        must_clauses.append({
            "match": {
                "location_country": {
                    "query": country.strip(),
                    "fuzziness": 0  # Allow fuzzy matching for country names
                }
            }
        })
        country_filter_added = True
        print(f"CoreSignal search - Adding country filter (REQUIRED - SECONDARY FILTER): '{country.strip()}'")
    
    # Add city filter as fallback if country is not available
    if not country_filter_added and city and city.strip() and city.lower() != "none":
        must_clauses.append({
            "multi_match": {
                "query": city.split()[0],
                "fields": [
                    "location_full",
                    "city",
                    "location"
                ]
            }
        })
        print(f"CoreSignal search - Adding city filter (fallback - country not available): '{city.split()[0]}'")
    
    if not country_filter_added and (not city or city.lower() == "none"):
        print(f"CoreSignal search - WARNING: No country or city filter available - location filtering disabled")
    
    # Add job title matching with variations (similar to Apollo's approach)
    if job_title and job_title.strip():
        job_title_clean = job_title.strip()
        
        # Build title variations for better matching
        # 1. Exact phrase match (primary)
        # 2. Individual important words (secondary - for broader results)
        title_words = job_title_clean.lower().split()
        
        # Filter out common filler words to get meaningful title words
        stop_words = {'senior', 'junior', 'lead', 'principal', 'associate', 'staff', 'head', 'chief', 'vice', 'assistant', 'executive', 'i', 'ii', 'iii', 'iv', 'v', 'level', 'sr', 'jr'}
        meaningful_words = [word for word in title_words if word.lower() not in stop_words and len(word) > 2]
        
        # Build should clauses for title matching
        title_should_clauses = [
            # Primary: Exact phrase match on active experience title
            {
                "match_phrase": {
                    "active_experience_title": {
                        "query": job_title_clean,
                        "slop": 2  # Allow 2 word difference for flexibility
                    }
                }
            },
            # Primary: Exact phrase match on headline
            {
                "match_phrase": {
                    "headline": {
                        "query": job_title_clean,
                        "slop": 2
                    }
                }
            }
        ]
        
        # Add individual meaningful words as fallback options
        for word in meaningful_words:
            title_should_clauses.append({
                "match": {
                    "active_experience_title": {
                        "query": word,
                        "fuzziness": "AUTO"
                    }
                }
            })
            title_should_clauses.append({
                "match": {
                    "headline": {
                        "query": word,
                        "fuzziness": "AUTO"
                    }
                }
            })
        
        must_clauses.append({
            "bool": {
                "should": title_should_clauses,
                "minimum_should_match": 1
            }
        })
        
        print(f"CoreSignal search - Adding job title filter: '{job_title_clean}' with variations: {meaningful_words}")
    
    payload = json.dumps({
        "query": {
            "bool": {
                "must": must_clauses
            }
        }
        # Note: CoreSignal API doesn't accept "size" parameter in body
        # Results are limited by the API's default pagination
    })

    try:
        response = requests.request("POST", url, headers=headers, data=payload, timeout=30)
        
        # Check for API errors
        if response.status_code != 200:
            print(f"CoreSignal API error: {response.status_code} - {response.text}")
            return []
        
        response_dict = response.json()
        
        # Handle different response formats
        if isinstance(response_dict, list):
            print(f"CoreSignal search - Number of resumes found: {len(response_dict)}")
            return response_dict
        elif isinstance(response_dict, dict):
            # Check for hits in Elasticsearch format
            if "hits" in response_dict:
                hits = response_dict.get("hits", [])
                # Extract _source or use hit directly
                resumes = [hit.get("_source") or hit for hit in hits]
                print(f"CoreSignal search - Number of resumes found: {len(resumes)}")
                return resumes
            else:
                # Try to find list in response
                for key, value in response_dict.items():
                    if isinstance(value, list):
                        print(f"CoreSignal search - Number of resumes found: {len(value)}")
                        return value
                print(f"CoreSignal search - Unexpected response format: {list(response_dict.keys())}")
                return []
        else:
            print(f"CoreSignal search - Unexpected response type: {type(response_dict)}")
            return []
            
    except requests.exceptions.Timeout:
        print("CoreSignal API request timed out")
        return []
    except requests.exceptions.RequestException as e:
        print(f"CoreSignal API request error: {e}")
        return []
    except Exception as e:
        print(f"CoreSignal search error: {e}")
        return []

def regression_search(city, keywords, interval=0.13, job_title=None, country=None, max_iterations=10, min_results=10, must_skills=None, optional_skills=None):
    """
    Optimized regression search with must/optional skills prioritization.
    Strategy:
    1. REQUIRED FILTERS (applied in all searches):
       - Must Skills: Primary filter (required)
       - Country: Secondary filter (required if available from job description)
    2. Phase 1: Try 100% must skills match (all must skills required) - target: at least 10 resumes
    3. Phase 2: If less than 10 resumes, gradually reduce k (number of must skills required) 
       until we get at least 10 resumes or reach max iterations
    4. Maximum 10 iterations to save API credits
    5. Optional skills are considered but not required (can be used for ranking/boosting later)
    
    Args:
        city: Location string (city name) - optional, used if country not available
        keywords: List of skill keywords (legacy parameter, will use must_skills + optional_skills if provided)
        interval: Step size for reducing k (default: 0.13) - used for gradual reduction
        job_title: Job title for exact matching (optional)
        country: Country name for filtering (REQUIRED - second most important filter after must skills)
        max_iterations: Maximum number of iterations (default: 10, hard limit)
        min_results: Minimum number of results to aim for (default: 10)
        must_skills: List of must-have skills (required skills - PRIMARY FILTER)
        optional_skills: List of optional skills (nice-to-have, considered but not required)
    
    Returns:
        Tuple of (list of resumes, final_k_value)
    """
    import time
    
    # Validate inputs
    must_skills_list = must_skills or []
    optional_skills_list = optional_skills or []
    
    if not must_skills_list and not optional_skills_list and not keywords:
        raise ValueError("Either keywords or (must_skills/optional_skills) must be provided")
    
    if not must_skills_list:
        # If no must skills, use all skills as must skills
        all_skills = optional_skills_list if optional_skills_list else (keywords or [])
        must_skills_list = all_skills
        optional_skills_list = []
    
    # Validate country filter (REQUIRED - second most important after must skills)
    if not country or str(country).strip().lower() == "none":
        # Try to use city if country is not available
        if city and str(city).strip().lower() != "none":
            print(f"CoreSignal regression - WARNING: Country not available, using city '{city}' as location filter")
        else:
            print(f"CoreSignal regression - WARNING: No country or city filter available - location filtering disabled")
    else:
        print(f"CoreSignal regression - Country filter (REQUIRED): '{country.strip()}'")
    
    # Format must skills for search
    formatted_must_keywords = [
        {
            "multi_match": {
                "query": str(skill).lower().strip(),
                "fields": ["inferred_skills", "historical_skills"],
                "type": "phrase"  # Use phrase matching for exact skill matching
            }
        }
        for skill in must_skills_list if skill and str(skill).strip()
    ]
    
    if not formatted_must_keywords:
        raise ValueError("No valid must skills provided after filtering")
    
    # Format optional skills for consideration (used in later phases if needed)
    formatted_optional_keywords = [
        {
            "multi_match": {
                "query": str(skill).lower().strip(),
                "fields": ["inferred_skills", "historical_skills"],
                "type": "phrase"
            }
        }
        for skill in optional_skills_list if skill and str(skill).strip()
    ] if optional_skills_list else []
    
    iteration = 0
    best_results = []
    best_k = 0
    total_must_skills = len(must_skills_list)
    
    # Validate and emphasize country filter (REQUIRED - second most important after must skills)
    country_available = country and country.strip() and country.lower() != "none"
    
    print(f"CoreSignal regression - Starting search with:")
    print(f"  - Must Skills (PRIMARY FILTER): {total_must_skills} skills")
    print(f"  - Optional Skills: {len(optional_skills_list)} skills")
    print(f"  - Country Filter (SECONDARY FILTER - REQUIRED): {country.strip() if country_available else 'Not available'}")
    print(f"  - Target: Find at least {min_results} resumes")
    if job_title:
        print(f"  - Job title filter: '{job_title}'")
    
    if not country_available:
        if city and city.strip() and city.lower() != "none":
            print(f"CoreSignal regression - WARNING: Country not available from job description, using city '{city}' as location filter")
        else:
            print(f"CoreSignal regression - WARNING: No country or city filter available - location filtering disabled")
    
    # Helper function to merge results avoiding duplicates
    def merge_results(existing_results, new_results):
        existing_ids = set()
        for r in existing_results:
            if isinstance(r, dict):
                existing_ids.add(str(r.get("id") or r.get("_id") or r.get("employee_id") or ""))
            else:
                existing_ids.add(str(r))
        
        merged_new = []
        for r in new_results:
            if isinstance(r, dict):
                resume_id = str(r.get("id") or r.get("_id") or r.get("employee_id") or "")
            else:
                resume_id = str(r)
            
            if resume_id and resume_id not in existing_ids:
                merged_new.append(r)
                existing_ids.add(resume_id)
        
        return merged_new
    
    # Phase 1: Try 100% must skills match (all must skills required)
    print(f"CoreSignal regression - Phase 1 (Iteration {iteration + 1}): Trying 100% must skills match (k={total_must_skills})")
    iteration += 1
    
    datapoints = search_resumes(city, formatted_must_keywords, total_must_skills, job_title=job_title, country=country)
    filtered = filter_resumes_by_location(datapoints, city, country)
    
    if filtered:
        best_results = filtered
        best_k = total_must_skills
        print(f"CoreSignal regression - Phase 1: Found {len(best_results)} resumes with 100% must skills match")
        
        # If we have enough results (>= 10), return early
        if len(best_results) >= min_results:
            print(f"CoreSignal regression - SUCCESS: Found {len(best_results)} results (>= {min_results}) with 100% must skills match, returning")
            num_to_return = min(10, len(best_results))
            return best_results[:num_to_return], best_k
    
    # Phase 2: If less than 10 resumes, gradually reduce k (number of must skills required)
    # Start from 100% and reduce by steps until we get at least 10 resumes
    if len(best_results) < min_results and iteration < max_iterations and total_must_skills > 1:
        print(f"CoreSignal regression - Phase 2: Need more results ({len(best_results)} < {min_results}), reducing k gradually")
        
        # Calculate reduction strategy
        # Start from current k (or 100% if no results yet)
        current_k = best_k if best_k > 0 else total_must_skills
        
        # Calculate step size: reduce by ~10% each iteration, but at least by 1
        # For small skill lists, reduce by 1 each time
        if total_must_skills <= 5:
            step = 1
        elif total_must_skills <= 10:
            step = max(1, int(total_must_skills * 0.2))  # 20% steps
        else:
            step = max(1, int(total_must_skills * 0.1))  # 10% steps
        
        # Minimum k: at least 1 skill must match, but prefer at least 30% if possible
        min_k = max(1, int(total_must_skills * 0.3))
        
        # If we already have some results, start reducing from current k
        # Otherwise start from total_must_skills - step
        if len(best_results) == 0:
            current_k = max(min_k, total_must_skills - step)
        else:
            current_k = max(min_k, current_k - step)
        
        last_k = None
        
        while len(best_results) < min_results and current_k >= min_k and iteration < max_iterations:
            # Prevent infinite loop: if k hasn't changed, stop
            if last_k is not None and current_k == last_k:
                print(f"CoreSignal regression - k unchanged ({current_k}), stopping to prevent loop")
                break
            
            last_k = current_k
            iteration += 1
            
            print(f"CoreSignal regression - Phase 2 Iteration {iteration}/{max_iterations}: Trying k={current_k} ({(current_k/total_must_skills)*100:.1f}% of {total_must_skills} must skills)")
            
            # Add small delay to prevent rate limiting
            time.sleep(0.5)
            
            datapoints = search_resumes(city, formatted_must_keywords, current_k, job_title=job_title, country=country)
            filtered = filter_resumes_by_location(datapoints, city, country)
            
            if filtered:
                # Merge with existing results, avoiding duplicates
                new_results = merge_results(best_results, filtered)
                best_results.extend(new_results)
                best_k = current_k
                print(f"CoreSignal regression - Found {len(new_results)} new resumes (total: {len(best_results)})")
                
                # If we have enough results, stop
                if len(best_results) >= min_results:
                    print(f"CoreSignal regression - SUCCESS: Found {len(best_results)} results (>= {min_results}), stopping")
                    break
            
            # Reduce k for next iteration
            current_k = max(min_k, current_k - step)
            
            # If we've reached minimum k and still don't have enough, try one more time with min_k
            if current_k <= min_k and len(best_results) < min_results and iteration < max_iterations:
                if last_k != min_k:  # Only try min_k if we haven't already
                    current_k = min_k
                else:
                    break
    
    # Final check: if we still don't have enough results
    if len(best_results) < min_results:
        if len(best_results) > 0:
            print(f"CoreSignal regression - WARNING: Only found {len(best_results)} results (target: {min_results}) after {iteration} iterations")
        else:
            print(f"CoreSignal regression - No results found after {iteration} iterations")
            return [], 0
    else:
        print(f"CoreSignal regression - SUCCESS: Found {len(best_results)} results (>= {min_results})")
    
    # Return up to 10 best matches (or as many as available)
    num_to_return = min(10, len(best_results))
    selected_resumes = best_results[:num_to_return]
    
    print(f"CoreSignal regression - Final: Returning top {num_to_return} resumes with k={best_k} ({(best_k/total_must_skills)*100:.1f}% must skills match)")
    
    return selected_resumes, best_k


def filter_resumes_by_location(resumes, job_city=None, job_country=None):
    """
    Filter resumes by matching location and country before enrichment.
    This saves API credits by only enriching resumes that match location.
    
    Args:
        resumes: List of resume dictionaries from search
        job_city: Job city name to match
        job_country: Job country name to match
    
    Returns:
        Filtered list of resumes that match location/country
    """
    if not resumes:
        return []
    
    # If no location filters, return all
    if (not job_city or str(job_city).lower() == "none") and (not job_country or str(job_country).lower() == "none"):
        return resumes
    
    filtered = []
    job_city_lower = str(job_city).lower().strip() if job_city and str(job_city).lower() != "none" else None
    job_country_lower = str(job_country).lower().strip() if job_country and str(job_country).lower() != "none" else None
    
    for resume in resumes:
        # Try to extract location from resume (could be dict or have different fields)
        resume_location = None
        resume_country = None
        
        if isinstance(resume, dict):
            # Try different possible location fields
            resume_location = (
                resume.get("location_full") or 
                resume.get("city") or 
                resume.get("location") or
                resume.get("_source", {}).get("location_full") or
                resume.get("_source", {}).get("city")
            )
            resume_country = (
                resume.get("location_country") or
                resume.get("country") or
                resume.get("_source", {}).get("location_country") or
                resume.get("_source", {}).get("country")
            )
        
        # Convert to strings and lowercase for comparison (handle None safely)
        resume_location_str = str(resume_location).lower() if resume_location else ""
        resume_country_str = str(resume_country).lower() if resume_country else ""
        
        # Check if location matches
        location_match = True
        if job_city_lower:
            # Check if job city appears in resume location
            if not resume_location_str or job_city_lower not in resume_location_str:
                # Also try matching first word of city
                city_first_word = job_city_lower.split()[0] if job_city_lower else ""
                if not city_first_word or (resume_location_str and city_first_word not in resume_location_str):
                    location_match = False
        
        country_match = True
        if job_country_lower:
            # Check if job country matches resume country
            if not resume_country_str or job_country_lower not in resume_country_str:
                country_match = False
        
        # Include resume if location or country matches (OR logic for flexibility)
        # But if both are specified, at least one must match
        if job_city_lower and job_country_lower:
            if location_match or country_match:
                filtered.append(resume)
        elif job_city_lower:
            if location_match:
                filtered.append(resume)
        elif job_country_lower:
            if country_match:
                filtered.append(resume)
        else:
            # No filters, include all
            filtered.append(resume)
    
    return filtered



def get_resume_details(resume_id):
    """
    Get detailed resume information from CoreSignal API.
    
    Args:
        resume_id: Resume/employee ID (string or int)
    
    Returns:
        Dictionary with resume details or None on error
    """
    if not resume_id:
        print("Error: No resume_id provided")
        return None
    
    url = f"https://api.coresignal.com/cdapi/v2/employee_multi_source/collect/{resume_id}"

    try:
        response = requests.request("GET", url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"CoreSignal API error getting resume details: {response.status_code} - {response.text}")
            return None
        
        response_dict = response.json()
        
        if not response_dict:
            print(f"No data returned for resume ID: {resume_id}")
            return None

        # Safely extract email
        email = ""
        try:
            primary_email = response_dict.get("primary_professional_email", "")
            if primary_email:
                match = re.search(r"email=([^}]+)", str(primary_email))
                if match:
                    email = match.group(1)
                else:
                    email = str(primary_email)
        except Exception as e:
            print(f"Error extracting email: {e}")

        # Safely extract all fields with defaults
        resume_id_value = response_dict.get("id") or resume_id
        total_months = response_dict.get("total_experience_duration_months", 0)
        try:
            experience = int(total_months / 12) if total_months else 0
        except (TypeError, ValueError):
            experience = 0

        data = {
            "id": "cs_" + str(resume_id_value),
            "linkedin_url": response_dict.get("linkedin_url", ""),
            "full_name": response_dict.get("full_name", ""),
            "headline": response_dict.get("headline", ""),
            "summary": response_dict.get("summary", ""),
            "location_country": response_dict.get("location_country", ""),
            "location_full": response_dict.get("location_full", ""),
            "skills": response_dict.get("inferred_skills", []),
            "email": email,
            "title": response_dict.get("active_experience_title", ""),
            "experience": experience,
        }
        
        return data
        
    except requests.exceptions.Timeout:
        print(f"Timeout getting resume details for ID: {resume_id}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Request error getting resume details: {e}")
        return None
    except Exception as e:
        print(f"Error getting resume details: {e}")
        import traceback
        print(traceback.format_exc())
        return None
