import base64
import requests
from datetime import datetime, timezone

# ----------------------------
# Setup
# ----------------------------
ACCOUNT_ID = "26418019"
SERVICE_KEY = "eM4iLRCssKHXOQMQSMoHyAN3KXPh7IpUEtVhh/TQ"

JD_ENDPOINTS = [
    "https://eu-rest.resumeparsing.com/v10/parser/joborder",
    "https://eu-rest.sovren.com/v10/parser/joborder",
    "https://eu-rest.resumeparsing.com/v10/parser/jobdescription",
    "https://eu-rest.sovren.com/v10/parser/jobdescription",
]

HEADERS = {
    "Sovren-AccountId": ACCOUNT_ID,
    "Sovren-ServiceKey": SERVICE_KEY,
    "Content-Type": "application/json",
}

# ----------------------------
# Helpers
# ----------------------------
def _today_ymd() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def _post_to_first_working_endpoint(payload: dict) -> requests.Response:
    last_error = None
    for url in JD_ENDPOINTS:
        try:
            resp = requests.post(url, headers=HEADERS, json=payload, timeout=30)
            if resp.status_code == 200:
                return resp
            if resp.status_code in (404, 405):
                last_error = resp
                continue
            raise Exception(f"Sovren API Error: {resp.status_code} {resp.text}")
        except requests.RequestException as e:
            last_error = e
            continue
    if isinstance(last_error, requests.Response):
        raise Exception(f"All endpoints failed. Last response: {last_error.status_code} {last_error.text}")
    raise Exception(f"All endpoints failed. Last error: {last_error}")

# ----------------------------
# Core functions (string input)
# ----------------------------
def parse_job_description_from_string(jd_text: str, doc_name: str = "job_description.txt") -> dict:
    """
    Send a job description string to Sovren v10 and return parsed JSON.
    Uses Base64 encoding for consistency.
    """
    file_bytes = jd_text.encode("utf-8")
    b64 = base64.b64encode(file_bytes).decode("utf-8")
    payload = {
        "DocumentAsBase64String": b64,
        "DocumentName": doc_name,
        "DocumentLastModified": _today_ymd(),
    }

    response = _post_to_first_working_endpoint(payload)
    response_data = response.json()
    
    # Save Sovren credits to database
    try:
        from database.mysql import SessionLocal
        from database.models.api_credits import ApiCredits
        from datetime import datetime
        
        sovren_credit = None
        
        # Try to get credits from response body (Info -> CustomerDetails -> CreditsRemaining)
        try:
            credits_remaining = response_data.get("Info", {}).get("CustomerDetails", {}).get("CreditsRemaining")
            if credits_remaining is not None:
                sovren_credit = int(float(credits_remaining))
        except (ValueError, TypeError, AttributeError):
            pass
            
        # Fallback: Check common credit header names if not found in body
        if sovren_credit is None:
            response_headers = dict(response.headers)
            credit_header_names = [
                'x-credits-remaining',
                'X-Credits-Remaining',
                'x-sovren-credits-remaining',
                'X-Sovren-Credits-Remaining',
                'credits-remaining',
                'Credits-Remaining'
            ]
            
            for header_name in credit_header_names:
                if header_name in response_headers:
                    try:
                        sovren_credit = int(response_headers[header_name])
                        break
                    except (ValueError, TypeError):
                        continue
        
        if sovren_credit is not None:
            db = SessionLocal()
            try:
                # Get or create Sovren credits record
                credits_record = db.query(ApiCredits).filter(ApiCredits.api_name == "sovren").first()
                if credits_record:
                    credits_record.credits_remaining = sovren_credit
                    credits_record.last_updated = datetime.now()
                else:
                    credits_record = ApiCredits(
                        api_name="sovren",
                        credits_remaining=sovren_credit
                    )
                    db.add(credits_record)
                db.commit()
            except Exception as e:
                print(f"Error saving Sovren credits to database: {e}")
                db.rollback()
            finally:
                db.close()
    except Exception as e:
        print(f"Error connecting to database to save Sovren credits: {e}")
    
    return response_data


# ----------------------------
# Helper function to extract all fields from parsed data
# ----------------------------
def extract_all_fields_from_parsed_data(parsed_data: dict) -> dict:
    """
    Extract all available fields from sovren parsed job description data.
    
    Args:
        parsed_data: The parsed JSON response from sovren parser
        
    Returns:
        Dictionary with extracted fields:
        - skills: List of skill names
        - email: Contact email
        - job_title: Job title (if extracted)
        - company_name: Company name (if extracted)
        - location: Location (if extracted)
        - requirements: Job requirements/qualifications
        - responsibilities: Job responsibilities
        - experience_level: Experience level required
        - education: Education requirements
        - salary: Salary information
        - benefits: Benefits information
        - job_type: Job type (full-time, part-time, etc.)
    """
    extracted = {
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
    
    if not parsed_data or not isinstance(parsed_data, dict):
        return extracted
    
    try:
        job_data = parsed_data.get("Value", {}).get("JobData", {})
        if not job_data:
            return extracted
        
        # Extract Skills
        try:
            skills_raw = job_data.get("Skills", {}).get("Raw", [])
            if isinstance(skills_raw, list):
                extracted["skills"] = [
                    skill.get("Name", "").lower() 
                    for skill in skills_raw 
                    if isinstance(skill, dict) and skill.get("Name")
                ]
        except (KeyError, TypeError, AttributeError):
            pass
        
        # Extract Email
        try:
            app_details = job_data.get("ApplicationDetails", {})
            if app_details:
                extracted["email"] = app_details.get("ContactEmail") or app_details.get("Email")
        except (KeyError, TypeError, AttributeError):
            pass
        
        # Extract Job Title
        try:
            extracted["job_title"] = job_data.get("JobTitle", {}).get("Raw") or job_data.get("PositionTitle")
        except (KeyError, TypeError, AttributeError):
            pass
        
        # Extract Company Name
        try:
            company_info = job_data.get("CompanyInfo", {})
            if company_info:
                extracted["company_name"] = company_info.get("CompanyName") or company_info.get("Name")
        except (KeyError, TypeError, AttributeError):
            pass
        
        # Extract Location
        try:
            location_info = job_data.get("Location", {})
            if location_info:
                city = location_info.get("City")
                state = location_info.get("State")
                country = location_info.get("Country")
                parts = [p for p in [city, state, country] if p]
                extracted["location"] = ", ".join(parts) if parts else None
        except (KeyError, TypeError, AttributeError):
            pass
        
        # Extract Requirements/Qualifications
        try:
            qualifications = job_data.get("Qualifications", {}).get("Raw", [])
            if isinstance(qualifications, list):
                extracted["requirements"] = [
                    qual.get("Description", "") 
                    for qual in qualifications 
                    if isinstance(qual, dict) and qual.get("Description")
                ]
        except (KeyError, TypeError, AttributeError):
            pass
        
        # Extract Responsibilities
        try:
            responsibilities = job_data.get("Responsibilities", {}).get("Raw", [])
            if isinstance(responsibilities, list):
                extracted["responsibilities"] = [
                    resp.get("Description", "") 
                    for resp in responsibilities 
                    if isinstance(resp, dict) and resp.get("Description")
                ]
        except (KeyError, TypeError, AttributeError):
            pass
        
        # Extract Experience Level
        try:
            exp_level = job_data.get("ExperienceLevel")
            if exp_level:
                extracted["experience_level"] = exp_level
        except (KeyError, TypeError, AttributeError):
            pass
        
        # Extract Education
        try:
            education = job_data.get("Education", {}).get("Raw", [])
            if isinstance(education, list):
                extracted["education"] = [
                    edu.get("Degree", "") or edu.get("Description", "")
                    for edu in education
                    if isinstance(edu, dict)
                ]
        except (KeyError, TypeError, AttributeError):
            pass
        
        # Extract Salary
        try:
            compensation = job_data.get("Compensation", {})
            if compensation:
                base_salary = compensation.get("BaseSalary") or compensation.get("Salary")
                currency = compensation.get("Currency")
                if base_salary:
                    salary_str = str(base_salary)
                    if currency:
                        salary_str = f"{currency} {salary_str}"
                    extracted["salary"] = salary_str
        except (KeyError, TypeError, AttributeError):
            pass
        
        # Extract Benefits
        try:
            benefits = job_data.get("Benefits", {}).get("Raw", [])
            if isinstance(benefits, list):
                extracted["benefits"] = [
                    benefit.get("Description", "") or str(benefit)
                    for benefit in benefits
                ]
        except (KeyError, TypeError, AttributeError):
            pass
        
        # Extract Job Type
        try:
            extracted["job_type"] = job_data.get("JobType") or job_data.get("EmploymentType")
        except (KeyError, TypeError, AttributeError):
            pass
            
    except Exception as e:
        print(f"Error extracting fields from sovren parsed data: {e}")
    
    return extracted


# ----------------------------
# Usage example
# ----------------------------
# if __name__ == "__main__":
    # sample_jd_text = """
    # We are looking for a Python developer with 3+ years of experience in Django, Flask, REST APIs,
    # and cloud deployment. Bachelor's degree required. AWS certification preferred.
    # """
    # parsed = parse_job_description_from_string(sample_jd_text)
    # extracted = extract_all_fields_from_parsed_data(parsed)
    # print(json.dumps(extracted, indent=2))