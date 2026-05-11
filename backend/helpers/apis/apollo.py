"""
Apollo.io API Integration for Resume Search and Enrichment

This module provides functions to search for resumes and enrich candidate data
using Apollo.io API, following the same logic as CoreSignal's implementation.

Required Parameters Returned by Apollo API (after enrichment):
- email: Contact email address (verified/likely status)
- phone: Phone number (requires reveal_phone_number flag and webhook)
- skills: List of skills (array of skill objects/strings)
- name: Full name (first_name + last_name)
- title: Current job title
- headline: Professional headline
- summary: Professional summary
- location: Location object with city, state, country
- linkedin_url: LinkedIn profile URL
- twitter_url: Twitter profile URL (if available)
- github_url: GitHub profile URL (if available)
- departments: List of departments
- employment_history: List of previous jobs with dates
- education: List of education entries
- organization: Company information (name, website, etc.)
- experience: Calculated years of experience from employment history

API Endpoints:
- SEARCH: https://api.apollo.io/api/v1/mixed_people/api_search
- ENRICH: https://api.apollo.io/api/v1/people/enrich

Search Parameters:
- person_locations: List of location strings (city/state/country)
- organization_locations: List of company locations
- person_titles: List of job titles
- person_seniorities: List of seniority levels
- email_status: ["verified", "likely"] - filter by email availability
- page: Page number for pagination
- per_page: Results per page (max 100)

Enrichment Parameters:
- id: Person ID (required)
- reveal_phone_number: Boolean (requires webhook_url)
- webhook_url: URL for async phone reveal callback

Note: Apollo API requires enrichment to get email, phone, and skills data.
Basic search results only include title, headline, and basic info.
"""

import requests
import json
import time
import re
import random
from datetime import datetime

# Apollo API Configuration
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
# Look for .env file in the backend directory (parent of helpers/apis)
backend_dir = Path(__file__).resolve().parent.parent.parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)

# Get API key from environment variable
API_KEY = os.getenv('APOLLO_API_KEY', '')  # Get from .env file
SEARCH_URL = "https://api.apollo.io/api/v1/mixed_people/api_search"
ENRICH_URL = "https://api.apollo.io/api/v1/people/enrich"

headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "accept": "application/json",
    "X-Api-Key": API_KEY
}


def search_resumes(city, keywords, k, page=1, per_page=50, job_title=None, seniority=None, api_keywords=None):  # OPTIMIZED: Increased per_page from 25 to 50 to get more results per API call
    """
    Search for resumes in Apollo API using location, skills, job title, and seniority.
    Similar to CoreSignal's search_resumes function.
    
    Args:
        city: City name or location string (e.g., "Navi Mumbai, Maharashtra, India")
        keywords: List of skills/keywords to search for (used for local filtering)
        k: Minimum number of keywords that must match (minimum_should_match)
        page: Page number for pagination (default: 1)
        per_page: Number of results per page (default: 25)
        job_title: Job title to search for (e.g., "Python Developer")
        seniority: Seniority level (e.g., "Mid-Senior level")
        api_keywords: Optional list of keywords to send to Apollo API (if different from keywords).
                      If None, uses 'keywords'.
    
    Returns:
        List of people/resumes found (list of person dictionaries)
    """
    # Build search payload with Apollo API parameters
    payload = {
        "page": page,
        "per_page": per_page
    }
    
    # Add exact job title filter (person_titles) - use exact title for better matching
    if job_title and job_title.strip():
        job_title_clean = job_title.strip()
        # Use exact title for better matching
        person_titles = [job_title_clean.lower()]
        
        # Also add variations for better matching (but prioritize exact match)
        title_words = job_title_clean.lower().split()
        if len(title_words) > 1:
            # Add main role word as secondary option
            person_titles.append(title_words[-1])
        
        payload["person_titles"] = person_titles
        print(f"Apollo search - Using exact person_titles: {person_titles}")
    
    # Add seniority filter (person_seniorities)
    if seniority:
        # Map seniority to Apollo format
        seniority_lower = seniority.lower()
        apollo_seniorities = []
        
        if "entry" in seniority_lower or "junior" in seniority_lower:
            apollo_seniorities.extend(["individual_contributor", "entry"])
        elif "mid" in seniority_lower or "senior" in seniority_lower:
            apollo_seniorities.extend(["senior", "individual_contributor", "manager"])
        elif "manager" in seniority_lower or "director" in seniority_lower:
            apollo_seniorities.extend(["manager", "director", "senior"])
        else:
            # Default to common seniorities
            apollo_seniorities = ["individual_contributor", "senior", "manager"]
        
        payload["person_seniorities"] = apollo_seniorities
        print(f"Apollo search - Using person_seniorities: {apollo_seniorities}")
    
    # Add location filters - use multiple location variations for better results
    if city:
        # Extract location components
        location_parts = [part.strip() for part in city.split(",")]
        city_name = location_parts[0] if location_parts else ""
        country = location_parts[-1] if len(location_parts) > 1 else ""
        
        # Build location list with variations
        locations = []
        if city_name:
            locations.append(city_name)  # Full city name (e.g., "Navi Mumbai")
            # Also add just the main city word if it's a compound name
            if " " in city_name:
                locations.append(city_name.split()[0])  # First word (e.g., "Navi")
        if country:
            locations.append(country)  # Country (e.g., "India")
        
        if locations:
            payload["person_locations"] = locations
            payload["organization_locations"] = locations
            print(f"Apollo search - Using locations: {locations}")
    
    # Filter to only people with emails (similar to CoreSignal's email requirement)
    payload["email_status"] = ["verified", "likely"]  # Only people with verified/likely emails
    
    # Use q_keywords to pass skills to Apollo's search for server-side filtering
    # q_keywords searches across contact name, title, company, and profile text
    # FIXED: Use api_keywords if provided, otherwise use keywords. 
    # This allows us to search with specific terms (must_skills) but filter locally with all keywords.
    keywords_to_send = api_keywords if api_keywords is not None else keywords
    
    if keywords_to_send and len(keywords_to_send) > 0:
        q_keywords_str = " ".join(str(kw) for kw in keywords_to_send if kw and str(kw).strip())
        if q_keywords_str.strip():
            payload["q_keywords"] = q_keywords_str
            print(f"Apollo search - Using q_keywords: {q_keywords_str}")
    
    # Debug: print the payload being sent
    print(f"Apollo search payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(SEARCH_URL, headers=headers, json=payload)
        
        if response.status_code != 200:
            print(f"Apollo search error: {response.status_code} - {response.text}")
            return []
        
        data = response.json()
        # Apollo API response structure: {"people": [...], "pagination": {"total": ..., "page": ..., "per_page": ...}}
        pagination = data.get("pagination", {}) if isinstance(data, dict) else {}
        total_results = pagination.get("total", 0) if isinstance(pagination, dict) else 0
        people = data.get("people", [])
        print(f"Apollo search - Total results: {total_results}, Returned: {len(people)}")
        
        # Debug: Show sample of first person to understand data structure
        if len(people) > 0:
            sample_person = people[0]
            print(f"Apollo search - Sample person keys: {list(sample_person.keys())[:10]}")
            print(f"Apollo search - Sample person title: {sample_person.get('title', 'N/A')}")
            print(f"Apollo search - Sample person headline: {sample_person.get('headline', 'N/A')[:100]}")
        
        # Filter by minimum keyword matches (k)
        # Since Apollo search doesn't directly support skill filtering,
        # we need to enrich and filter results post-search
        if keywords and k > 0 and len(people) > 0:
            filtered_people = []
            keywords_lower = [str(kw).lower().strip() for kw in keywords if kw]
            print(f"Apollo search - Filtering {len(people)} people by {len(keywords_lower)} keywords (k={k})")
            
            for person in people:
                # Get basic text from person data (before enrichment)
                person_text = " ".join([
                    person.get("title", ""),
                    person.get("headline", ""),
                    person.get("summary", "")
                ]).lower()
                
                # Count how many keywords match in basic fields
                matches = sum(1 for keyword in keywords_lower if keyword in person_text)
                
                # If we don't have enough matches in basic fields, we'd need to enrich
                # For now, include if at least k keywords match in basic fields
                # In a production system, you might want to enrich all and then filter
                # If we don't have enough matches in basic fields, we still include them if fields are missing
                # This allows potential candidates to pass through to enrichment where full data is available
                # Logic: If matches >= k OR (matches > 0 and (not person.get("headline") or not person.get("summary")))
                if matches >= k:
                    filtered_people.append(person)
                elif matches > 0:
                     # If at least one keyword matches, keep it (safer bet than strict k)
                     filtered_people.append(person)
                elif not person.get("headline") and not person.get("summary"):
                    # If fields are missing, give benefit of doubt
                    filtered_people.append(person)
            
            # If keyword filtering removed all results, return first few results anyway
            # (they match title/location/seniority which are the primary filters)
            original_count = len(people)
            if len(filtered_people) == 0 and original_count > 0:
                print(f"Apollo search - Keyword filtering removed all {original_count} results")
                print(f"Apollo search - Returning first {min(5, original_count)} results without keyword filter (they match title/location/seniority)")
                # Return first few results that match title/location/seniority
                people = people[:min(5, original_count)]
            else:
                people = filtered_people
                print(f"Apollo search - Keyword filtering kept {len(people)} out of {original_count} results")
        elif len(people) > 0:
            # No keywords provided, return results as-is
            print(f"Apollo search - No keyword filtering, returning {len(people)} results")
        
        print(f"Apollo search: Found {len(people)} resumes (after filtering)")
        return people
        
    except Exception as e:
        print(f"Apollo search exception: {e}")
        return []


def regression_search(city, keywords, interval=0.13, job_title=None, seniority=None, max_iterations=8, max_enrichments=30, must_skills=None, optional_skills=None):
    """
    Optimized regression search with must/optional skills prioritization, exact job title and skills matching.
    
    OPTIMIZATIONS FOR API TOKEN REDUCTION:
    - Starts with smart initial k (30-50% of must skills) instead of 100% to reduce iterations
    - Limits regression to max 4 iterations (instead of 8) to reduce API calls
    - Uses larger interval steps (0.2 instead of 0.13) for faster convergence
    - Increased per_page to 50 to get more results per search API call
    - Removed enrichment during regression loop - only enriches final candidates in endpoint
    - Enrichment happens only once for top 15 candidates instead of repeatedly during search
    
    Args:
        city: Location string
        keywords: List of skill keywords (legacy parameter, will use must_skills + optional_skills if provided)
        interval: Step size for reducing k (default: 0.13)
        job_title: Job title for exact matching (optional)
        seniority: Seniority level (optional)
        max_iterations: Maximum regression iterations (default: 8)
        max_enrichments: Maximum candidates to enrich per iteration (default: 30, increased for top 10)
        must_skills: List of must-have skills (required skills that should always be matched)
        optional_skills: List of optional skills (nice-to-have skills)
    
    Returns:
        Tuple of (list of resumes, final_k_value)
    """
    import time
    
    # Use must_skills + optional_skills if provided, otherwise fall back to keywords
    all_skills = []
    if must_skills:
        all_skills.extend(must_skills)
    if optional_skills:
        all_skills.extend(optional_skills)
    if not all_skills and keywords:
        all_skills = keywords
    
    if not all_skills or len(all_skills) == 0:
        # If no keywords, try search without keyword filtering
        print("Apollo regression - No keywords provided, searching without keyword filter")
        datapoints = search_resumes(city, [], 0, job_title=job_title, seniority=seniority)
        if len(datapoints) > 0:
            num_to_return = min(10, len(datapoints))
            return datapoints[:num_to_return], 0
        return [], 0
    
    must_skills_list = must_skills or []
    optional_skills_list = optional_skills or []
    
    formatted_keywords = [str(kw).lower().strip() for kw in all_skills if kw and str(kw).strip()]
    formatted_must_keywords = [str(kw).lower().strip() for kw in must_skills_list if kw and str(kw).strip()] if must_skills_list else []
    
    if not formatted_keywords:
        print("Apollo regression - No valid keywords after filtering")
        return [], 0
    
    value = 1.0
    MIN_VALUE = 0.1
    iteration = 0
    last_k = None
    best_results = []  # All candidates found
    best_results_with_all_must = []  # Candidates matching ALL must skills
    
    # Phase 1: Start with must skills if available, otherwise use all skills
    # OPTIMIZED: Use smarter initial k to reduce iterations and API calls
    search_keywords = formatted_must_keywords if formatted_must_keywords else formatted_keywords
    
    # FIXED: For API call, ONLY use must_skills.
    # If no must_skills are provided, we do NOT send keywords to the API (sending empty list).
    # This avoids the strict AND behavior of Apollo (which would return 0 results if we sent all optional keywords).
    # We will rely on location/title filtering in the API, and keyword filtering locally.
    
    # NEW FIX: If job_title is provided, we prioritize finding candidates with that title and location,
    # and filter by skills locally. Sending all must_skills to API might be too restrictive if there are many.
    # So if job_title is present, we don't send ANY skill keywords to API to maximize recall.
    if job_title:
        api_search_keywords = []
        print(f"Apollo regression - Job title provided ('{job_title}'), ignoring must_skills for API search to maximize recall.")
    else:
        api_search_keywords = formatted_must_keywords
    
    if formatted_must_keywords and len(formatted_must_keywords) > 10:
        # For many must skills, start with ~30% to avoid too many iterations
        initial_k = max(5, int(len(formatted_must_keywords) * 0.3))
    elif formatted_must_keywords and len(formatted_must_keywords) > 5:
        # For medium must skills, use ~50%
        initial_k = max(3, int(len(formatted_must_keywords) * 0.5))
    else:
        initial_k = max(1, len(search_keywords))
    
    k = initial_k
    
    print(f"Apollo regression - Starting search with must_skills={len(must_skills_list)}, optional_skills={len(optional_skills_list)}")
    print(f"Apollo regression - API Query Keywords: {api_search_keywords}")
    print(f"Apollo regression - Phase 1: Searching with k={k} (optimized from {len(search_keywords)} total must skills)")
    if job_title:
        print(f"Apollo regression - Job title filter: '{job_title}'")
    
    # First search attempt with must skills (lightweight - no enrichment yet)
    # FIXED: Pass api_keywords explicitly to control what goes to API vs what is used for local filtering
    datapoints = search_resumes(city, search_keywords, k, job_title=job_title, seniority=seniority, api_keywords=api_search_keywords)
    iteration += 1
    
    # OPTIMIZED: Don't enrich during search - only collect IDs
    # Enrichment happens later for final candidates only
    if datapoints:
        best_results = datapoints
        print(f"Apollo regression - Phase 1: Found {len(datapoints)} candidates (not enriching yet to save API credits)")
    else:
        best_results = []
    
    # Regression loop - continue if we need more results
    # OPTIMIZED: Limit iterations to reduce API calls
    min_results = 10  # Target top 10
    optimized_max_iterations = min(4, max_iterations)  # Max 4 iterations instead of 8
    optimized_interval = 0.2  # Larger step for faster convergence
    
    while len(best_results) < min_results and value >= MIN_VALUE and iteration < optimized_max_iterations:
        value -= optimized_interval
        required_k = len(formatted_must_keywords) if formatted_must_keywords else max(1, int(len(formatted_keywords) * value))
        k = max(1, int(len(search_keywords) * value))
        
        # Prevent infinite loop: if k hasn't changed, stop
        if last_k is not None and k == last_k:
            print(f"Apollo regression - k unchanged ({k}), stopping to prevent loop")
            break
        
        last_k = k
        iteration += 1
        
        print(f"Apollo regression - Iteration {iteration}/{max_iterations}: value={value:.2f}, k={k}, current_best={len(best_results)}")
        
        # Add delay to prevent rate limiting
        time.sleep(0.5)
        
        # Re-search with lower k (lightweight - no enrichment)
        # OPTIMIZED: Use per_page=50 to get more results per API call
        # FIXED: Pass api_keywords explicitly to control what goes to API vs what is used for local filtering
        datapoints = search_resumes(city, search_keywords, k, page=1, per_page=50, job_title=job_title, seniority=seniority, api_keywords=api_search_keywords)
        
        # OPTIMIZED: Just collect IDs, don't enrich during regression
        if datapoints:
            # Avoid duplicates
            existing_ids = set()
            for p in best_results:
                if isinstance(p, dict):
                    existing_ids.add(str(p.get("id") or ""))
                else:
                    existing_ids.add(str(p))
            
            new_results = []
            for person in datapoints:
                person_id = str(person.get("id") or "") if isinstance(person, dict) else str(person)
                if person_id and person_id not in existing_ids:
                    new_results.append(person)
                    existing_ids.add(person_id)
            
            best_results.extend(new_results)
            print(f"Apollo regression - Found {len(new_results)} new candidates (total: {len(best_results)}) - not enriching yet")
        
        # If we have enough results, break
        if len(best_results) >= min_results:
            break
        
        # Safety check
        if value <= 0:
            break
    
    # Safety check: if we hit max iterations without results, return empty
    if iteration >= max_iterations and len(best_results) == 0:
        print(f"Apollo regression - Reached max iterations ({max_iterations}) without results")
        return [], 0
    
    if len(best_results) == 0:
        print(f"Apollo regression - No results found after {iteration} iterations")
        return [], 0
    
    # OPTIMIZED: Return top candidates without enrichment
    # Enrichment will happen in the endpoint after scoring
    num_to_return = min(15, len(best_results))  # Get a few extra for filtering
    selected_resumes = best_results[:num_to_return]
    
    print(f"Apollo regression - Found {len(best_results)} results, returning top {num_to_return} with k={k}")
    
    return selected_resumes, k



def get_resume_details(person_id_or_dict, reveal_phone=False, webhook_url=None):
    """
    Get detailed resume information for a person, including enrichment.
    
    Args:
        person_id_or_dict: Apollo person ID (string/int) or person dictionary with 'id' field
        reveal_phone: Whether to reveal phone number (requires webhook)
        webhook_url: Webhook URL for async phone reveal
    
    Returns:
        Dictionary with enriched resume data (email, phone, skills, name, title, etc.)
    """
    # Extract person_id if a dictionary is passed (for compatibility with CoreSignal)
    # Also store the original person dict to extract skills as fallback
    original_person_dict = None
    if isinstance(person_id_or_dict, dict):
        original_person_dict = person_id_or_dict
        person_id = person_id_or_dict.get("id")
        # Remove "apollo_" prefix if present (from previous enrichment)
        if person_id and isinstance(person_id, str) and person_id.startswith("apollo_"):
            person_id = person_id.replace("apollo_", "")
    else:
        person_id = person_id_or_dict
        # Remove "apollo_" prefix if present
        if person_id and isinstance(person_id, str) and person_id.startswith("apollo_"):
            person_id = person_id.replace("apollo_", "")
    
    if not person_id:
        print("No person ID provided")
        return _get_basic_person_info(None)
    
    print(f"Apollo enrich - Using person_id: {person_id}")
    
    # First, enrich the person to get full details
    enrich_payload = {"id": person_id}
    
    if reveal_phone and webhook_url:
        enrich_payload["reveal_phone_number"] = True
        enrich_payload["webhook_url"] = webhook_url
    
    try:
        print(f"Apollo enrich - Calling enrich API for person_id: {person_id}")
        print(f"Apollo enrich - URL: {ENRICH_URL}")
        print(f"Apollo enrich - Payload: {json.dumps(enrich_payload, indent=2)}")
        
        enrich_response = requests.post(ENRICH_URL, headers=headers, json=enrich_payload)
        
        print(f"Apollo enrich - Response status: {enrich_response.status_code}")
        
        if enrich_response.status_code != 200:
            print(f"Apollo enrich error for ID {person_id}: {enrich_response.status_code} - {enrich_response.text}")
            # Try to get basic info from search if enrichment fails
            return _get_basic_person_info(person_id)
        
        response_data = enrich_response.json()
        print(f"Apollo enrich - Full response keys: {list(response_data.keys())}")
        
        enriched = response_data.get("person", {})
        if not enriched:
            # Try alternative response structure
            enriched = response_data.get("data", {}) or response_data
        
        # Debug: Log what Apollo returned
        print(f"Apollo enrich - Person keys: {list(enriched.keys())[:30]}")
        print(f"Apollo enrich - Has email field: {'email' in enriched}")
        print(f"Apollo enrich - Has location field: {'location' in enriched}")
        print(f"Apollo enrich - Has skills field: {'skills' in enriched}")
        print(f"Apollo enrich - Has technologies field: {'technologies' in enriched}")
        
        # Debug: Print full location structure
        if "location" in enriched:
            print(f"Apollo enrich - Location structure: {json.dumps(enriched.get('location'), indent=2)}")
        
        # Debug: Print skills structure
        if "skills" in enriched:
            print(f"Apollo enrich - Skills structure (first 3): {json.dumps(enriched.get('skills', [])[:3], indent=2)}")
        
        # Debug: Print technologies structure
        if "technologies" in enriched:
            print(f"Apollo enrich - Technologies structure (first 3): {json.dumps(enriched.get('technologies', [])[:3], indent=2)}")
        
        # Extract email - check multiple possible fields
        email = enriched.get("email")
        if not email or email == "unavailable":
            # Try alternative email fields
            email = enriched.get("email_status")
            if email and isinstance(email, list) and len(email) > 0:
                email = email[0] if isinstance(email[0], str) else None
            if not email or email == "unavailable":
                # Check if email is in a nested structure
                email_data = enriched.get("email_data", {})
                if email_data:
                    email = email_data.get("email") or email_data.get("address")
                if not email:
                    email = "None"
        
        # Extract phone
        phone = None
        phone_numbers = enriched.get("phone_numbers", [])
        if phone_numbers and len(phone_numbers) > 0:
            # Handle both dict and list formats
            if isinstance(phone_numbers[0], dict):
                phone = phone_numbers[0].get("raw_number") or phone_numbers[0].get("sanitized_number") or phone_numbers[0].get("number")
            else:
                phone = str(phone_numbers[0])
        
        # Extract skills - comprehensive extraction from all possible Apollo API fields
        # According to Apollo.io API docs, skills can be in multiple formats and locations
        processed_skills = []
        
        # 1. Primary skills field (most common)
        skills = enriched.get("skills", [])
        
        # 2. Alternative skill fields that Apollo might use
        if not skills or not isinstance(skills, list) or len(skills) == 0:
            # Try alternative skill fields in order of likelihood
            skills = (
                enriched.get("skill_names", []) or 
                enriched.get("inferred_skills", []) or 
                enriched.get("top_skills", []) or
                enriched.get("person_skills", []) or
                enriched.get("technologies", []) or
                enriched.get("expertise", []) or
                enriched.get("competencies", [])
            )
        
        # 2b. Extract technologies separately (keep them separate from skills for better organization)
        processed_technologies = []
        technologies = enriched.get("technologies", [])
        if technologies and isinstance(technologies, list):
            for tech in technologies:
                if isinstance(tech, dict):
                    tech_name = (
                        tech.get("name") or 
                        tech.get("technology") or 
                        tech.get("title") or 
                        tech.get("value") or
                        tech.get("text") or
                        tech.get("label")
                    )
                    if tech_name and str(tech_name).strip():
                        tech_str = str(tech_name).strip()
                        processed_technologies.append(tech_str)
                        # Also add to skills for backward compatibility
                        processed_skills.append(tech_str)
                elif isinstance(tech, str) and tech.strip():
                    tech_str = tech.strip()
                    processed_technologies.append(tech_str)
                    # Also add to skills for backward compatibility
                    processed_skills.append(tech_str)
        elif technologies and isinstance(technologies, str) and technologies.strip():
            tech_list = [t.strip() for t in technologies.split(",") if t.strip()]
            processed_technologies.extend(tech_list)
            # Also add to skills for backward compatibility
            processed_skills.extend(tech_list)
        
        # 3. Process skills list (handle both dict and string formats)
        if isinstance(skills, list) and len(skills) > 0:
            for skill in skills:
                if isinstance(skill, dict):
                    # Try all possible keys for skill name in dict format
                    skill_name = (
                        skill.get("name") or 
                        skill.get("skill") or 
                        skill.get("title") or 
                        skill.get("skill_name") or
                        skill.get("value") or
                        skill.get("text") or
                        skill.get("label")
                    )
                    if skill_name and str(skill_name).strip():
                        processed_skills.append(str(skill_name).strip())
                elif isinstance(skill, str) and skill.strip():
                    processed_skills.append(skill.strip())
        elif isinstance(skills, str) and skills.strip():
            # If skills is a comma-separated string, split it
            processed_skills.extend([s.strip() for s in skills.split(",") if s.strip()])
        
        # 4. Extract skills from employment history (jobs often have skills listed)
        employment_history = enriched.get("employment_history", [])
        if employment_history:
            for job in employment_history[:5]:  # Check first 5 jobs for more comprehensive extraction
                # Check for skills in job object
                job_skills = job.get("skills", []) or job.get("skill_names", [])
                if job_skills:
                    if isinstance(job_skills, list):
                        for js in job_skills:
                            if isinstance(js, dict):
                                js_name = js.get("name") or js.get("skill") or js.get("value")
                                if js_name and str(js_name).strip():
                                    processed_skills.append(str(js_name).strip())
                            elif isinstance(js, str) and js.strip():
                                processed_skills.append(js.strip())
                    elif isinstance(job_skills, str) and job_skills.strip():
                        processed_skills.append(job_skills.strip())
                
                # Also check technologies separately in each job
                job_technologies = job.get("technologies", [])
                if job_technologies:
                    if isinstance(job_technologies, list):
                        for jt in job_technologies:
                            if isinstance(jt, dict):
                                jt_name = (
                                    jt.get("name") or 
                                    jt.get("technology") or 
                                    jt.get("value") or
                                    jt.get("title")
                                )
                                if jt_name and str(jt_name).strip():
                                    tech_str = str(jt_name).strip()
                                    processed_technologies.append(tech_str)
                                    # Also add to skills for backward compatibility
                                    processed_skills.append(tech_str)
                            elif isinstance(jt, str) and jt.strip():
                                tech_str = jt.strip()
                                processed_technologies.append(tech_str)
                                # Also add to skills for backward compatibility
                                processed_skills.append(tech_str)
                    elif isinstance(job_technologies, str) and job_technologies.strip():
                        tech_list = [t.strip() for t in job_technologies.split(",") if t.strip()]
                        processed_technologies.extend(tech_list)
                        # Also add to skills for backward compatibility
                        processed_skills.extend(tech_list)
                
                # Extract skills from job description/summary text
                job_description = (
                    job.get("description", "") or 
                    job.get("summary", "") or 
                    job.get("title", "")
                )
                if job_description:
                    # Look for common skill patterns in text (optional - can be enhanced with NLP)
                    pass  # Could add text parsing here if needed
        
        # 5. Extract skills from education history
        education = enriched.get("education", [])
        if education:
            for edu in education[:3]:  # Check first 3 education entries
                edu_skills = edu.get("skills", []) or edu.get("fields_of_study", [])
                if edu_skills:
                    if isinstance(edu_skills, list):
                        for es in edu_skills:
                            if isinstance(es, str) and es.strip():
                                processed_skills.append(es.strip())
                    elif isinstance(edu_skills, str) and edu_skills.strip():
                        processed_skills.append(edu_skills.strip())
        
        # 6. Extract from summary and headline (text fields that might mention skills)
        summary = enriched.get("summary", "") or enriched.get("headline", "")
        # Note: Could parse summary for skills, but this is less reliable without NLP
        
        # 7. Remove duplicates while preserving order for skills
        seen = set()
        unique_skills = []
        for skill in processed_skills:
            skill_lower = skill.lower()
            if skill_lower not in seen and len(skill) > 1:  # Filter out single characters
                seen.add(skill_lower)
                unique_skills.append(skill)
        
        # 7b. Remove duplicates while preserving order for technologies
        seen_tech = set()
        unique_technologies = []
        for tech in processed_technologies:
            tech_lower = tech.lower()
            if tech_lower not in seen_tech and len(tech) > 1:  # Filter out single characters
                seen_tech.add(tech_lower)
                unique_technologies.append(tech)
        
        # 8. Fallback: If no skills found in enrichment, try to extract from original search response
        if len(unique_skills) == 0 and original_person_dict:
            print("Apollo enrich - No skills in enrichment response, checking search response...")
            # Extract from search response fields
            search_skills = (
                original_person_dict.get("skills", []) or
                original_person_dict.get("skill_names", []) or
                original_person_dict.get("inferred_skills", [])
            )
            if search_skills:
                if isinstance(search_skills, list):
                    for ss in search_skills:
                        if isinstance(ss, dict):
                            ss_name = ss.get("name") or ss.get("skill") or ss.get("value")
                            if ss_name and str(ss_name).strip():
                                unique_skills.append(str(ss_name).strip())
                        elif isinstance(ss, str) and ss.strip():
                            unique_skills.append(ss.strip())
                elif isinstance(search_skills, str) and search_skills.strip():
                    unique_skills.extend([s.strip() for s in search_skills.split(",") if s.strip()])
            
            # Also extract technologies from search response
            search_technologies = original_person_dict.get("technologies", [])
            if search_technologies:
                if isinstance(search_technologies, list):
                    for st in search_technologies:
                        if isinstance(st, dict):
                            st_name = st.get("name") or st.get("technology") or st.get("value")
                            if st_name and str(st_name).strip():
                                unique_technologies.append(str(st_name).strip())
                        elif isinstance(st, str) and st.strip():
                            unique_technologies.append(st.strip())
                elif isinstance(search_technologies, str) and search_technologies.strip():
                    unique_technologies.extend([t.strip() for t in search_technologies.split(",") if t.strip()])
            
            # Also check headline and title for skill keywords
            headline = original_person_dict.get("headline", "") or original_person_dict.get("title", "")
            if headline:
                # Basic extraction: look for common tech terms (can be enhanced)
                pass  # Could add keyword extraction here
        
        # 9. Limit to top 30 skills (increased from 20 for better coverage)
        skills = unique_skills[:30]
        
        # 9b. Limit technologies to top 30
        technologies = unique_technologies[:30]
        
        print(f"Apollo enrich - Extracted {len(skills)} unique skills from enrichment response")
        if len(skills) > 0:
            print(f"Apollo enrich - Skills sample: {skills[:10]}")
        else:
            print("Apollo enrich - Warning: No skills extracted from Apollo API response")
        
        print(f"Apollo enrich - Extracted {len(technologies)} unique technologies from enrichment response")
        if len(technologies) > 0:
            print(f"Apollo enrich - Technologies sample: {technologies[:10]}")
        
        # Extract name
        first_name = enriched.get("first_name", "")
        last_name = enriched.get("last_name", "")
        full_name = f"{first_name} {last_name}".strip() or enriched.get("name", "")
        
        # Extract location - check multiple possible formats and parse thoroughly
        location = enriched.get("location", {})
        
        # If location is not a dict, try to get it from alternative fields
        if not location or not isinstance(location, dict):
            # Try alternative location fields
            location = enriched.get("city_state_country", {}) or {}
            if not location or not isinstance(location, dict):
                # Try to construct location from separate fields
                location = {}
        
        location_full = None
        location_country = ""
        
        # Extract location components from location dict
        city = location.get("city", "") if isinstance(location, dict) else ""
        state = location.get("state", "") if isinstance(location, dict) else ""
        country = location.get("country", "") if isinstance(location, dict) else ""
        
        # If location dict is empty or missing fields, try getting from top-level fields
        if not city and not state and not country:
            city = enriched.get("city", "")
            state = enriched.get("state", "")
            country = enriched.get("country", "")
        
        # Also check for location in nested structures
        if not city and not state and not country:
            # Check for location in organization
            org = enriched.get("organization", {})
            if isinstance(org, dict):
                org_location = org.get("location", {})
                if isinstance(org_location, dict):
                    city = city or org_location.get("city", "")
                    state = state or org_location.get("state", "")
                    country = country or org_location.get("country", "")
        
        # Check for address_line_1, address_line_2, etc.
        if not city:
            city = enriched.get("address_line_1", "") or enriched.get("address_city", "")
        if not state:
            state = enriched.get("address_state", "") or enriched.get("state_province", "")
        if not country:
            country = enriched.get("address_country", "") or enriched.get("country_code", "")
        
        location_country = country
        
        # Build location_full string
        location_parts = [p for p in [city, state, country] if p and p.strip()]
        location_full = ", ".join(location_parts) if location_parts else None
        
        # If still no location, try parsing from raw_address or other fields
        if not location_full:
            raw_address = enriched.get("raw_address", "")
            if raw_address:
                location_full = raw_address
        
        print(f"Apollo enrich - Extracted location - City: '{city}', State: '{state}', Country: '{country}'")
        print(f"Apollo enrich - Location full: {location_full}")
        print(f"Apollo enrich - Email: {email}")
        
        # Extract title
        title = enriched.get("title", "") or enriched.get("headline", "")
        
        # Extract experience (calculate from employment history)
        experience = 0
        employment_history = enriched.get("employment_history", [])
        if employment_history:
            # Calculate total years from employment history
            total_months = 0
            for job in employment_history:
                start_date = job.get("start_date")
                end_date = job.get("end_date") or "present"
                # Simple calculation (you might want to parse dates properly)
                if start_date:
                    try:
                        # Try to extract year from date string
                        start_year = int(re.search(r'\d{4}', str(start_date)).group()) if re.search(r'\d{4}', str(start_date)) else None
                        if end_date and end_date.lower() != "present":
                            end_year = int(re.search(r'\d{4}', str(end_date)).group()) if re.search(r'\d{4}', str(end_date)) else None
                        else:
                            end_year = datetime.now().year
                        
                        if start_year and end_year:
                            total_months += (end_year - start_year) * 12
                    except:
                        pass
            
            experience = int(total_months / 12) if total_months > 0 else 0
        
        # Build response data (matching CoreSignal format)
        data = {
            "id": "ap_" + str(person_id),
            "linkedin_url": enriched.get("linkedin_url", ""),
            "full_name": full_name,
            "headline": enriched.get("headline", ""),
            "summary": enriched.get("summary", ""),
            "location_country": location_country,
            "location_full": location_full or "",
            "skills": skills,
            "technologies": technologies,  # Add technologies as separate field
            "email": email or "None",
            "phone": phone or "None",
            "title": title,
            "experience": experience,
            # Additional Apollo-specific fields
            "departments": enriched.get("departments", []),
            #"employment_history": employment_history[:5],  # Last 5 jobs
            # "education": enriched.get("education", []),
            # "twitter_url": enriched.get("twitter_url", ""),
            # "github_url": enriched.get("github_url", ""),
            "company_name": enriched.get("organization", {}).get("name", "") if enriched.get("organization") else "",
            "company_website": enriched.get("organization", {}).get("website_url", "") if enriched.get("organization") else "",
        }
        
        return data
        
    except Exception as e:
        print(f"Apollo get_resume_details exception: {e}")
        return _get_basic_person_info(person_id)


def _get_basic_person_info(person_id):
    """
    Fallback: Get basic person info if enrichment fails.
    """
    return {
        "id": "apollo_" + str(person_id),
        "linkedin_url": "",
        "full_name": "",
        "headline": "",
        "summary": "",
        "location_country": "",
        "location_full": "",
        "skills": [],
        "email": "None",
        "phone": "None",
        "title": "",
        "experience": 0,
        "departments": [],
        "employment_history": [],
        "education": [],
        "twitter_url": "",
        "github_url": "",
        "company_name": "",
        "company_website": "",
    }


def search_resumes_by_skills(skills, limit=25, location=None):
    """
    Search resumes using only skills as parameter (no location filter).
    Used by the /api/apollo/resumes/by-skills endpoint.
    
    Args:
        skills: List of skills to search for
        limit: Maximum number of results to return (default: 25)
        location: Optional location filter
    
    Returns:
        List of resume dictionaries with enriched data
    """
    if not skills or len(skills) == 0:
        return []
    
    # Build search payload
    # Use q_keywords to pass skills to Apollo's search for server-side filtering
    q_keywords_str = " ".join(str(s) for s in skills if s and str(s).strip())
    payload = {
        "email_status": ["verified", "likely"],  # Only people with emails
        "page": 1,
        "per_page": min(limit * 2, 100),  # Get more results to filter from
        "q_keywords": q_keywords_str  # Pass skills as keywords for server-side filtering
    }
    print(f"Apollo search_by_skills - Using q_keywords: {q_keywords_str}")
    
    # Add location if provided
    if location:
        payload["person_locations"] = [location]
        payload["organization_locations"] = [location]
    
    try:
        response = requests.post(SEARCH_URL, headers=headers, json=payload)
        
        if response.status_code != 200:
            print(f"Apollo search by skills error: {response.status_code} - {response.text}")
            return []
        
        data = response.json()
        people = data.get("people", [])
        
        # Enrich each person to get skills and filter by provided skills
        enriched_resumes = []
        skills_lower = [str(skill).lower().strip() for skill in skills if skill]
        
        for person in people:
            if len(enriched_resumes) >= limit:
                break
                
            person_id = person.get("id")
            if person_id:
                # Add rate limiting to avoid API throttling
                time.sleep(0.5)  # Small delay between enrichments
                resume_details = get_resume_details(person_id)
                
                # Check if person has at least one of the required skills
                person_skills = [str(s).lower() for s in resume_details.get("skills", [])]
                has_skill = any(skill in " ".join(person_skills) for skill in skills_lower)
                
                if has_skill or len(skills_lower) == 0:
                    enriched_resumes.append(resume_details)
        
        return enriched_resumes
        
    except Exception as e:
        print(f"Apollo search_resumes_by_skills exception: {e}")
        return []

