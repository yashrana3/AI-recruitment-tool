from geopy.geocoders import Nominatim
from geopy.distance import geodesic
from difflib import SequenceMatcher

def get_match(job_details, resumes, k, job_title=None, mandatory_skills=None, must_skills=None, optional_skills=None, experience_years=None, preference="skills"):
    
    data = {}
    breakdowns = {}
    
    # Extract must/optional skills (prioritize new parameters)
    must_skills_list = must_skills or []
    optional_skills_list = optional_skills or []
    
    # Fallback to mandatory_skills if must_skills not provided
    if not must_skills_list:
        job_skills = mandatory_skills or job_details.get("company_keywords", [])
        if isinstance(job_skills, str):
            must_skills_list = [kw.strip().lower() for kw in job_skills.split(",") if kw.strip()]
        elif isinstance(job_skills, list):
            must_skills_list = [str(s).strip().lower() for s in job_skills if s and str(s).strip()]
    
    # Normalize skills
    must_skills_list = [str(s).strip().lower() for s in must_skills_list if s and str(s).strip()]
    optional_skills_list = [str(s).strip().lower() for s in optional_skills_list if s and str(s).strip()]
    
    # Extract job title
    job_title_str = job_title or job_details.get("title", "") or ""
    job_title_lower = str(job_title_str).lower().strip()
    
    # Extract meaningful words from job title (filter stop words)
    stop_words = {'senior', 'junior', 'lead', 'principal', 'associate', 'staff', 'head', 
                  'chief', 'vice', 'assistant', 'executive', 'i', 'ii', 'iii', 'iv', 'v', 
                  'level', 'sr', 'jr', 'the', 'a', 'an', 'and', 'or', 'of', 'for', 'at', 'in'}
    job_title_words = [w for w in job_title_lower.split() if w not in stop_words and len(w) > 2]
    
    # Normalize preference
    preference = (preference or "skills").lower()
    
    # Job location
    job_city = str(job_details.get("location", "") or "").strip().lower()
    job_country = str(job_details.get("country", "") or "").strip().lower()
    
    # Build location string for geocoding
    job_location_parts = []
    if job_city and job_city != "none":
        job_location_parts.append(job_city)
    if job_country and job_country != "none":
        job_location_parts.append(job_country)
    job_location = ", ".join(job_location_parts) if job_location_parts else None
    
    # Geocoder setup
    geolocator = Nominatim(user_agent="distance_calc", timeout=10)
    location_cache = {}
    
    def get_coords(location):
        if not location or not str(location).strip():
            return None
        loc_str = str(location).strip()
        if loc_str not in location_cache:
            try:
                loc = geolocator.geocode(loc_str, timeout=10)
                if loc:
                    location_cache[loc_str] = (loc.latitude, loc.longitude)
                else:
                    location_cache[loc_str] = None
            except Exception as e:
                print(f"Geocoding error for '{loc_str}': {e}")
                location_cache[loc_str] = None
        return location_cache.get(loc_str)
    
    # Get job coordinates (only if we have location)
    job_coords = get_coords(job_location) if job_location else None
    
    # Helper function for fuzzy skill matching
    def skill_matches(skill1: str, skill2: str) -> bool:
        """Check if two skills match using fuzzy/partial matching"""
        skill1_lower = skill1.lower().strip()
        skill2_lower = skill2.lower().strip()
        
        # Exact match
        if skill1_lower == skill2_lower:
            return True
        
        # Substring match (e.g., "test" matches "automated testing")
        if skill1_lower in skill2_lower or skill2_lower in skill1_lower:
            return True
        
        # Fuzzy match using SequenceMatcher (similarity >= 0.85)
        similarity = SequenceMatcher(None, skill1_lower, skill2_lower).ratio()
        if similarity >= 0.85:
            return True
        
        # Word-based match - check if key words match
        # e.g., "automated testing" vs "automated test" - both have "automated" and "test"
        skill1_words = set(skill1_lower.split())
        skill2_words = set(skill2_lower.split())
        if len(skill1_words) >= 2 and len(skill2_words) >= 2:
            # If most words match, consider it a match
            common_words = skill1_words & skill2_words
            if len(common_words) >= min(2, len(skill1_words) - 1, len(skill2_words) - 1):
                return True
        
        return False
    
    for resume in resumes:
        resume_id = str(resume.get("id", ""))
        if not resume_id:
            continue
        
        # Initialize scores
        location_score = 0
        skills_score = 0
        experience_score = 0
        
        resume_skills = resume.get("skills", [])
        if isinstance(resume_skills, str):
            resume_skills = [s.strip().lower() for s in resume_skills.split(",") if s.strip()]
        elif isinstance(resume_skills, list):
            resume_skills = [str(s).strip().lower() for s in resume_skills if s and str(s).strip()]
        else:
            resume_skills = []
        
        # === SKILL MATCHING (70% - Percentile-based) ===
        # Count Must Skills (M) and Matched Skills (R)
        M = len(must_skills_list) if must_skills_list else 0
        
        # Fallback to legacy skills if must_skills_list is empty
        if M == 0:
            job_skills_legacy = job_details.get("company_keywords", [])
            if isinstance(job_skills_legacy, str):
                must_skills_list = [kw.strip().lower() for kw in job_skills_legacy.split(",") if kw.strip()]
            elif isinstance(job_skills_legacy, list):
                must_skills_list = [str(s).strip().lower() for s in job_skills_legacy if s and str(s).strip()]
            M = len(must_skills_list) if must_skills_list else 0
        
        # Count matched must skills (R)
        R = 0
        if must_skills_list and M > 0:
            for must_skill in must_skills_list:
                if any(skill_matches(must_skill, resume_skill) 
                       for resume_skill in resume_skills):
                    R += 1
        
        # Count optional skills (O) and matched optional (O_matched) for skills_score formula
        O = len(optional_skills_list) if optional_skills_list else 0
        O_matched = 0
        if optional_skills_list and O > 0:
            for opt_skill in optional_skills_list:
                if any(skill_matches(opt_skill, resume_skill) for resume_skill in resume_skills):
                    O_matched += 1
        
        # Calculate Skill Score: 70% of 70 pts = 49 from must, 30% of 70 pts = 21 from optional (100% only when all must and all optional matched)
        MUST_PTS = 49
        OPTIONAL_PTS = 21
        if M == 0 and O == 0:
            skills_score = 0
            print(f"  {resume_id}: Skills - No must/optional skills defined (+0)")
        elif M > 0 and O > 0:
            must_part = (R / M) * MUST_PTS
            optional_part = (O_matched / O) * OPTIONAL_PTS
            skills_score = must_part + optional_part
            print(f"  {resume_id}: Skills - Must {R}/{M} (+{must_part:.1f}) Optional {O_matched}/{O} (+{optional_part:.1f}) = {skills_score:.1f}")
        elif M > 0:
            must_part = (R / M) * MUST_PTS
            optional_part = OPTIONAL_PTS  # no optional list → full optional share
            skills_score = must_part + optional_part
            print(f"  {resume_id}: Skills - Must {R}/{M} (+{must_part:.1f}) Optional n/a (+{optional_part:.1f}) = {skills_score:.1f}")
        else:
            # O > 0, M == 0: all 70 pts from optional
            optional_part = (O_matched / O) * 70
            skills_score = optional_part
            print(f"  {resume_id}: Skills - Must n/a Optional {O_matched}/{O} (+{skills_score:.1f}) = {skills_score:.1f}")
        
        # === LOCATION SCORE (20% - Percentile-based) ===
        resume_location_full = str(resume.get("location_full", "") or "").lower().strip()
        resume_country = str(resume.get("location_country", "") or "").lower().strip()
        resume_city = str(resume.get("city", "") or "").lower().strip()
        
        # Check if remote is allowed (from job_details)
        remote_allowed = job_details.get("remote", False) or job_details.get("remote_allowed", False) or str(job_details.get("remote", "")).lower() in ["true", "yes", "1"]
        
        # Location scoring: Same City → 20, Same Country → 10, Remote Allowed → 15, No Match → 0
        if job_city and job_city != "none":
            if job_city in resume_location_full or job_city in resume_city:
                location_score = 20  # Same City
                print(f"  {resume_id}: Location - Same city match (+20)")
            elif job_country and job_country != "none" and (job_country in resume_country or job_country in resume_location_full):
                location_score = 10  # Same Country
                print(f"  {resume_id}: Location - Same country match (+10)")
            elif remote_allowed:
                location_score = 15  # Remote Allowed
                print(f"  {resume_id}: Location - Remote allowed (+15)")
            else:
                location_score = 0  # No Match
                print(f"  {resume_id}: Location - No match (+0)")
        elif job_country and job_country != "none":
            # No city specified, check country only
            if job_country in resume_country or job_country in resume_location_full:
                location_score = 10  # Same Country
                print(f"  {resume_id}: Location - Same country match (no city filter) (+10)")
            elif remote_allowed:
                location_score = 15  # Remote Allowed
                print(f"  {resume_id}: Location - Remote allowed (+15)")
            else:
                location_score = 0  # No Match
                print(f"  {resume_id}: Location - No match (+0)")
        elif remote_allowed:
            location_score = 15  # Remote Allowed
            print(f"  {resume_id}: Location - Remote allowed (+15)")
        else:
            location_score = 0  # No Match
            print(f"  {resume_id}: Location - No match (+0)")
        
        # === EXPERIENCE SCORE (10% - Percentile-based) ===
        if experience_years is not None and isinstance(experience_years, (int, float)) and experience_years > 0:
            # Try to extract experience from resume
            resume_experience = None
            
            # Check experience field
            if resume.get("experience"):
                try:
                    resume_experience = int(resume.get("experience"))
                except (ValueError, TypeError):
                    pass
            
            # Check total_experience_duration_months (if available)
            if resume_experience is None:
                total_months = resume.get("total_experience_duration_months")
                if total_months:
                    try:
                        resume_experience = int(total_months / 12)
                    except (ValueError, TypeError):
                        pass
            
            # Calculate experience score using percentile-based system (10 pts max)
            if resume_experience is not None:
                if resume_experience >= experience_years:
                    # CandExp ≥ ReqExp → 10
                    experience_score = 10
                    print(f"  {resume_id}: Experience - Candidate meets requirement ({resume_experience} ≥ {experience_years} years) (+10)")
                elif resume_experience >= (experience_years * 0.8):
                    # CandExp ≥ 80% ReqExp → 7
                    experience_score = 7
                    print(f"  {resume_id}: Experience - Candidate at 80% ({resume_experience} ≥ {experience_years * 0.8} years) (+7)")
                elif resume_experience >= (experience_years * 0.5):
                    # CandExp ≥ 50% ReqExp → 5
                    experience_score = 5
                    print(f"  {resume_id}: Experience - Candidate at 50% ({resume_experience} ≥ {experience_years * 0.5} years) (+5)")
                else:
                    # Else → 0
                    experience_score = 0
                    print(f"  {resume_id}: Experience - Below 50% ({resume_experience} < {experience_years * 0.5} years) (+0)")
            else:
                experience_score = 0
                print(f"  {resume_id}: Experience - Not available in resume (+0)")
        else:
            experience_score = 0
            if experience_years is None:
                print(f"  {resume_id}: Experience - No requirement specified (+0)")
        
        # === TOTAL SCORE (Percentile-based: Skills 70% + Location 20% + Experience 10% = 100%) ===
        total_score = round(skills_score + location_score + experience_score, 2)
        data[resume_id] = total_score
        
        # Create detailed scoring breakdown with individual skill tracking
        matched_must_skills_list = []
        unmatched_must_skills_list = []
        matched_optional_skills_list = []
        unmatched_optional_skills_list = []
        
        # Always count must skills matched/unmatched using fuzzy matching
        if must_skills_list:
            for must_skill in must_skills_list:
                matched = any(skill_matches(must_skill, resume_skill) 
                            for resume_skill in resume_skills)
                if matched:
                    matched_must_skills_list.append(must_skill)
                else:
                    unmatched_must_skills_list.append(must_skill)
        
        # Always count optional skills matched/unmatched using fuzzy matching
        if optional_skills_list:
            for opt_skill in optional_skills_list:
                matched = any(skill_matches(opt_skill, resume_skill) 
                            for resume_skill in resume_skills)
                if matched:
                    matched_optional_skills_list.append(opt_skill)
                else:
                    unmatched_optional_skills_list.append(opt_skill)
        
        matched_must_count = len(matched_must_skills_list)
        matched_optional_count = len(matched_optional_skills_list)
        matched_all_skills_count = matched_must_count + matched_optional_count
        
        breakdown = {
            "job_title_score": 0,  # Not used in percentile system
            "skills_score": round(skills_score, 2),
            "must_skills_matched": matched_must_count,
            "must_skills_total": len(must_skills_list),
            "must_skills_matched_list": matched_must_skills_list,
            "must_skills_unmatched_list": unmatched_must_skills_list,
            "optional_skills_matched": matched_optional_count,
            "optional_skills_total": len(optional_skills_list),
            "optional_skills_matched_list": matched_optional_skills_list,
            "optional_skills_unmatched_list": unmatched_optional_skills_list,
            "all_skills_matched": matched_all_skills_count,
            "all_skills_total": len(must_skills_list) + len(optional_skills_list),
            "location_score": round(location_score, 2),
            "experience_score": round(experience_score, 2),
            "total_score": round(total_score, 2),
            "preference": preference
        }
        
        breakdowns[resume_id] = breakdown
        
        print(f"Score for {resume_id}: {total_score} (skills: {skills_score:.1f}, location: {location_score}, experience: {experience_score})")
    
    # === CALCULATE PERCENTILE BASED ON ALL CANDIDATES ===
    if data:
        # Get all scores sorted in descending order
        all_scores = sorted(data.values(), reverse=True)
        total_candidates = len(all_scores)
        
        # Calculate percentile for each candidate
        for resume_id in data:
            candidate_score = data[resume_id]
            
            # Count how many candidates have higher scores (better than this candidate)
            candidates_better = sum(1 for score in all_scores if score > candidate_score)
            # Count how many candidates have lower scores (worse than this candidate)
            candidates_worse = sum(1 for score in all_scores if score < candidate_score)
            # Count how many candidates have the same score
            candidates_same = sum(1 for score in all_scores if score == candidate_score)
            
            # Calculate percentile: what percentage of candidates is this candidate better than?
            # Percentile = (candidates worse / total candidates) * 100
            # This shows what percentage of candidates this candidate is better than
            percentile = (candidates_worse / total_candidates) * 100 if total_candidates > 0 else 0
            percentile = round(percentile, 2)
            
            # Calculate rank (1-based, where 1 is best)
            rank = candidates_better + 1
            
            # Update breakdown with percentile
            if resume_id in breakdowns:
                breakdowns[resume_id]["percentile"] = percentile
                breakdowns[resume_id]["rank"] = rank
                breakdowns[resume_id]["total_candidates"] = total_candidates
                breakdowns[resume_id]["candidates_better"] = candidates_better
                breakdowns[resume_id]["candidates_worse"] = candidates_worse
                
                print(f"Percentile for {resume_id}: {percentile}% (rank: {rank}/{total_candidates}, better than {candidates_worse} candidates, score: {candidate_score})")
    
    return data, breakdowns

