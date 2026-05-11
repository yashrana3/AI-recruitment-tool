"""
Skill Classification Module

Extracts and classifies skills from job descriptions into must (required) and optional categories.
Also extracts experience requirements from job descriptions.
"""

import re
import os
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from dotenv import load_dotenv
from .apis.sovren_parser import parse_job_description_from_string, extract_all_fields_from_parsed_data

# OpenAI Configuration (use OPENAI_SKILL_MODEL in .env for gpt-5.1 or other model)
_openai_available = None
_openai_model = os.getenv("OPENAI_SKILL_MODEL", "gpt-4o")  # gpt-4o for quality; set OPENAI_SKILL_MODEL=gpt-5.1 when available
_openai_api_key = os.getenv("OPENAI_API_KEY", "")

def _check_openai_available():
    """Check if OpenAI API is available and configured.
    
    Returns:
        True if OpenAI API key is set, False otherwise
    """
    global _openai_available, _openai_api_key
    if _openai_available is None:
        try:
            _openai_api_key = os.getenv("OPENAI_API_KEY", "")
            if _openai_api_key and _openai_api_key.strip():
                _openai_available = True
                print(f"Skill classifier: OpenAI API available with model {_openai_model}")
                return True
            else:
                print("Skill classifier: OPENAI_API_KEY not found in environment variables.")
                print("  Set OPENAI_API_KEY in .env file")
                _openai_available = False
                return False
        except Exception as e:
            print(f"Skill classifier: Failed to check OpenAI availability: {e}")
            _openai_available = False
            return False
    return _openai_available if _openai_available is not False else False


# Requirement keyword indicators
MUST_HAVE_KEYWORDS = [
    "required", "must have", "must", "essential", "mandatory", 
    "necessary", "prerequisite", "critical", "compulsory", "need"
]

PREFERRED_KEYWORDS = [
    "preferred", "nice to have", "bonus", "pluses", "helpful", 
    "desired", "plus", "advantage", "asset", "optional"
]

# Common technical/programming skills that are typically must-have when mentioned
TECHNICAL_SKILL_INDICATORS = {
    # Programming languages
    "java", "python", "javascript", "typescript", "c++", "c#", "go", "rust", 
    "php", "ruby", "swift", "kotlin", "scala", "r", "matlab", "dart","big data","bigdata"
    # Frameworks and libraries
    "react", "react.js", "angular", "vue", "vue.js", "node.js", "django", 
    "flask", "spring", "spring boot", "express", "nest.js", "next.js",
    ".net", "asp.net", "laravel", "rails", "ruby on rails",
    # Databases
    "sql", "mysql", "postgresql", "mongodb", "redis", "elasticsearch",
    # Cloud and DevOps
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins",
    # Tools and technologies
    "git", "rest", "graphql", "microservices", "api", "ci/cd"
}

# Non-keyword phrases that must never appear in must_skills or optional_skills.
# Normalized (lowercase, collapsed spaces) for matching.
NON_KEYWORD_SKILL_BLOCKLIST = frozenset({
    "communicate effectively", "getting stuff done", "performance oriented",
    "team player", "right to work", "background check", "health insurance",
    "remote work", "managing teams", "product engineering", "software engineering",
    "software development", "r&d", "r and d", "open-source", "opensource",
    "open source", "system integration", "added advantage", "governance",
    "passionate", "innovative", "competitive salary", "competitive benefit",
    "equity", "fast-paced", "entrepreneurial culture", "company benefits",
    "nextgen", "next gen", "cloud governance", "cloud ecosystem",
    "best practices", "unit testing", "test automation", "continuous integration",
})


def _normalize_for_blocklist(s: str) -> str:
    """Normalize string for blocklist matching: lowercase, collapse spaces."""
    if not s or not isinstance(s, str):
        return ""
    return re.sub(r"\s+", " ", s.lower().strip())


def is_non_keyword_skill(skill: str) -> bool:
    """
    Return True if the skill is a non-keyword (phrase, soft skill, vague term)
    that must never appear in must_skills or optional_skills.
    """
    if not skill or not isinstance(skill, str):
        return True
    norm = _normalize_for_blocklist(skill)
    if not norm:
        return True
    # Exact match
    if norm in NON_KEYWORD_SKILL_BLOCKLIST:
        return True
    # Blocklist phrase contained in skill (e.g. "communicate effectively" in "communicate effectively with stakeholders")
    for blocked in NON_KEYWORD_SKILL_BLOCKLIST:
        if blocked in norm:
            return True
    # Skill equals or is contained in a blocklist phrase
    for blocked in NON_KEYWORD_SKILL_BLOCKLIST:
        if norm in blocked:
            return True
    # Soft-skill phrase patterns
    if "effectively" in norm or " oriented" in norm or "oriented " in norm:
        return True
    return False


def normalize_skill_name(skill: str) -> str:
    """
    Normalize skill names to handle variations like:
    - "springboot" vs "spring-boot" vs "spring boot"
    - "css3" vs "css-3" vs "css 3"
    - "node.js" vs "nodejs" vs "node js"
    
    Args:
        skill: Skill name to normalize
        
    Returns:
        Normalized skill name
    """
    if not skill:
        return ""
    
    # Convert to lowercase and strip
    normalized = str(skill).lower().strip()
    
    # Remove all hyphens, underscores, and spaces (unify variations)
    # This makes "spring-boot" = "springboot" = "spring boot"
    normalized = re.sub(r'[-_\s]+', '', normalized)
    
    # Handle common variations
    # Spring Boot variations
    if normalized in ['springboot', 'springbootframework']:
        normalized = 'springboot'
    elif normalized.startswith('spring') and 'boot' in normalized:
        normalized = 'springboot'
    
    # Node.js variations
    if normalized in ['nodejs', 'node']:
        normalized = 'nodejs'
    
    # CSS variations
    if normalized in ['css3', 'css']:
        normalized = 'css3'
    elif normalized.startswith('css') and '3' in normalized:
        normalized = 'css3'
    
    # HTML variations
    if normalized in ['html5', 'html']:
        normalized = 'html5'
    elif normalized.startswith('html') and '5' in normalized:
        normalized = 'html5'
    
    # React variations
    if normalized in ['reactjs', 'react']:
        normalized = 'react'
    
    # Angular variations
    if normalized in ['angularjs', 'angular']:
        normalized = 'angular'
    
    return normalized


def deduplicate_skills(skills: List[str]) -> Tuple[List[str], Dict[str, str]]:
    """
    Deduplicate skills by normalizing them and creating a mapping.
    
    Args:
        skills: List of skill names (may contain duplicates/variations)
        
    Returns:
        Tuple of (unique_normalized_skills, skill_mapping)
        skill_mapping: Maps normalized skill to the first original variation found
    """
    skill_mapping = {}  # normalized -> first original
    normalized_to_original = {}  # normalized -> list of originals
    
    for skill in skills:
        if not skill:
            continue
        
        original = str(skill).strip()
        normalized = normalize_skill_name(original)
        
        if normalized:
            if normalized not in skill_mapping:
                skill_mapping[normalized] = original
            if normalized not in normalized_to_original:
                normalized_to_original[normalized] = []
            normalized_to_original[normalized].append(original)
    
    # Return unique normalized skills and mapping
    unique_normalized = list(skill_mapping.keys())
    
    return unique_normalized, skill_mapping


def detect_requirement_keywords(text: str) -> Tuple[bool, bool, float]:
    """
    Detect requirement keywords in text and return requirement indicators.
    
    Args:
        text: Text to analyze
        
    Returns:
        Tuple of (has_must_keywords, has_preferred_keywords, keyword_score)
        keyword_score: 1.0 if must-have, 0.5 if preferred, 0.0 otherwise
    """
    if not text or not isinstance(text, str):
        return False, False, 0.0
    
    text_lower = text.lower()
    
    # Check for must-have keywords
    has_must = any(keyword in text_lower for keyword in MUST_HAVE_KEYWORDS)
    
    # Check for preferred keywords
    has_preferred = any(keyword in text_lower for keyword in PREFERRED_KEYWORDS)
    
    # Calculate score
    score = 0.0
    if has_must:
        score = 1.0
    elif has_preferred:
        score = 0.5
    
    return has_must, has_preferred, score


def is_technical_skill(skill: str) -> bool:
    """
    Check if a skill is a technical/programming skill.
    
    Args:
        skill: Skill name to check
        
    Returns:
        True if the skill is a technical skill
    """
    if not skill:
        return False
    
    skill_lower = skill.lower().strip()
    
    # Direct match in technical indicators
    if skill_lower in TECHNICAL_SKILL_INDICATORS:
        return True
    
    # Check if skill contains technical indicators (for things like "react.js" vs "react")
    for tech in TECHNICAL_SKILL_INDICATORS:
        if tech in skill_lower or skill_lower in tech:
            return True
    
    # Common patterns for technical skills
    tech_patterns = [
        r'\b(java|python|javascript|typescript|c\+\+|c#|go|rust|php|ruby|swift|kotlin|scala)\b',
        r'\b(react|angular|vue|node|django|flask|spring|express|nest|next|\.net|asp\.net|laravel|rails)\b',
        r'\b(mysql|postgresql|mongodb|redis|elasticsearch|sql)\b',
        r'\b(aws|azure|gcp|docker|kubernetes|terraform|jenkins|git)\b',
        r'\b(api|rest|graphql|microservices|ci/cd)\b'
    ]
    
    for pattern in tech_patterns:
        if re.search(pattern, skill_lower, re.IGNORECASE):
            return True
    
    return False


def find_skill_mentions(skill: str, text: str) -> List[Tuple[int, int, str]]:
    """
    Find all mentions of a skill in text and return their positions with context.
    
    Args:
        skill: Skill name to search for
        text: Text to search in
        
    Returns:
        List of (start_pos, end_pos, context_sentence) tuples
    """
    if not text or not skill:
        return []
    
    mentions = []
    skill_lower = skill.lower()
    text_lower = text.lower()
    
    # Simple word-boundary aware search
    words = skill_lower.split()
    if len(words) == 1:
        # Single word skill - use word boundaries
        pattern = r'\b' + re.escape(words[0]) + r'\b'
    else:
        # Multi-word skill - search for phrase
        pattern = re.escape(skill_lower)
    
    # Find all matches
    for match in re.finditer(pattern, text_lower, re.IGNORECASE):
        start, end = match.span()
        
        # Extract context (surrounding sentence or ~100 chars)
        context_start = max(0, start - 150)
        context_end = min(len(text), end + 150)
        context = text[context_start:context_end].strip()
        
        mentions.append((start, end, context))
    
    return mentions


def calculate_skill_requirement_score(
    skill: str, 
    description: str, 
    sovren_fields: Dict,
    openai_available: bool = False
) -> float:
    """
    Calculate how "required" a skill appears to be based on context and keyword analysis.
    
    Args:
        skill: Skill name
        description: Full job description
        sovren_fields: Parsed fields from Sovren
        openai_available: Whether OpenAI API is available (for future LLM-based scoring)
        
    Returns:
        Score between 0.0 (optional) and 1.0 (must-have)
    """
    if not skill or not description:
        return 0.0
    
    scores = []
    weights = []
    
    # 1. Keyword-based semantic analysis (40% weight)
    # Note: Ollama LLM-based classification is handled separately in classify_skills_with_ml
    skill_mentions = find_skill_mentions(skill, description)
    if skill_mentions:
        semantic_score = 0.0
        skill_lower = skill.lower()
        
        # Analyze each mention for requirement keywords
        for _, _, context in skill_mentions[:5]:  # Check up to 5 mentions
            context_lower = context.lower()
            
            # Check for requirement keywords in context
            must_keywords_in_context = any(kw in context_lower for kw in MUST_HAVE_KEYWORDS)
            pref_keywords_in_context = any(kw in context_lower for kw in PREFERRED_KEYWORDS)
            
            if must_keywords_in_context:
                semantic_score = max(semantic_score, 0.9)
            elif pref_keywords_in_context:
                semantic_score = max(semantic_score, 0.4)
            else:
                # Check proximity to requirement keywords (within same sentence/phrase)
                words = context_lower.split()
                skill_pos = None
                for i, word in enumerate(words):
                    if skill_lower in word:
                        skill_pos = i
                        break
                
                if skill_pos is not None:
                    # Check words near the skill mention
                    nearby_words = words[max(0, skill_pos-5):skill_pos+6]
                    nearby_text = " ".join(nearby_words)
                    if any(kw in nearby_text for kw in MUST_HAVE_KEYWORDS):
                        semantic_score = max(semantic_score, 0.7)
                    elif any(kw in nearby_text for kw in PREFERRED_KEYWORDS):
                        semantic_score = max(semantic_score, 0.3)
        
        if semantic_score > 0:
            scores.append(semantic_score)
            weights.append(0.4)
    
    # 2. Positional weight (30% weight)
    positional_score = 0.0
    requirements_text = " ".join(sovren_fields.get("requirements", [])).lower()
    responsibilities_text = " ".join(sovren_fields.get("responsibilities", [])).lower()
    general_text = description.lower()
    
    skill_lower = skill.lower()
    is_tech = is_technical_skill(skill)
    
    if skill_lower in requirements_text:
        positional_score = 1.0
        # Technical skills in requirements are almost always must-have - boost score
        if is_tech:
            positional_score = 1.0  # Already max, but ensure it stays high
    elif skill_lower in responsibilities_text:
        positional_score = 0.6
        # Technical skills in responsibilities are often required
        if is_tech:
            positional_score = 0.8  # Boost for technical skills
    elif skill_lower in general_text:
        positional_score = 0.3
        # Technical skills mentioned anywhere are more likely to be required
        if is_tech:
            positional_score = 0.5  # Boost for technical skills
    
    scores.append(positional_score)
    weights.append(0.3)
    
    # 3. Explicit keyword bonus (20% weight)
    keyword_score = 0.0
    skill_mentions = find_skill_mentions(skill, description)
    
    for _, _, context in skill_mentions[:3]:  # Check top 3 mentions
        has_must, has_preferred, ctx_score = detect_requirement_keywords(context)
        keyword_score = max(keyword_score, ctx_score)
    
    scores.append(keyword_score)
    weights.append(0.2)
    
    # 4. Frequency normalized (10% weight)
    mention_count = len(find_skill_mentions(skill, description))
    # Normalize frequency (more mentions = higher score, capped at 1.0)
    freq_score = min(1.0, mention_count / 5.0)  # 5+ mentions = max score
    
    scores.append(freq_score)
    weights.append(0.1)
    
    # Weighted average
    if weights and sum(weights) > 0:
        final_score = sum(s * w for s, w in zip(scores, weights)) / sum(weights)
        
        # Additional boost for technical skills that appear in requirements
        # This ensures technical skills like "java", "react" get properly classified
        is_tech = is_technical_skill(skill)
        requirements_text = " ".join(sovren_fields.get("requirements", [])).lower()
        skill_lower = skill.lower()
        
        if is_tech and skill_lower in requirements_text:
            # Technical skill in requirements = must-have, boost to at least 0.75
            final_score = max(final_score, 0.75)
        elif is_tech and final_score > 0.3:
            # Technical skill mentioned anywhere with decent score = likely required
            final_score = min(1.0, final_score * 1.2)  # 20% boost
        
        return min(1.0, max(0.0, final_score))
    
    return 0.0


def _filter_technical_skills_with_openai(all_skills: List[str]) -> List[str]:
    """
    Use LLM (same model as classifier, e.g. OPENAI_SKILL_MODEL=gpt-5.1) to keep only
    technical keywords. Excludes soft skills, communication, hygiene, supportive,
    collaboration, and similar general terms. Returns subset of all_skills.
    """
    if not all_skills:
        return []
    try:
        from openai import OpenAI
        import json
        client = OpenAI(api_key=_openai_api_key)
        skills_list = ", ".join(all_skills[:80])
        prompt = f"""You are a technical skill filter. You are given a list of skills extracted from a job description. Many are NON-TECHNICAL and must be excluded.

## INPUT SKILLS (candidate list)
{skills_list}

## TASK
Return a JSON object with a single key "technical_skills" whose value is an array of strings. The array must contain ONLY the technical keywords from the input list. Return the exact phrases as they appear in the input (or normalized lowercase).

## INCLUDE ONLY (technical keywords)
- Programming languages: Python, Java, JavaScript, Go, C++, etc.
- Frameworks/libraries: React, Django, Spring Boot, etc.
- Tools & platforms: Git, AWS, Azure, Docker, Kubernetes, MongoDB, Jenkins, etc.
- Protocols/APIs: REST, GraphQL, CI/CD, etc.
- Short methodologies: Agile, Scrum (only these as technical).

## EXCLUDE (do not include in technical_skills) are examples of non-technical keywords
- Soft skills: collaboration, teamwork, leadership, flexibility, adaptability, supportive, problem-solving (as soft skill), communication (any: written communication, verbal communication, etc.)
- General/generic terms: hygiene, time management, organization, attention to detail, self-motivated, proactive, critical thinking (when generic)
- Company/culture: team player, passionate, innovative, fast-paced, etc.
- Any phrase that is not a concrete technology, tool, language, or framework.

Return ONLY valid JSON, no markdown, no explanation. Example: {{"technical_skills": ["python", "aws", "docker"]}}"""

        response = client.chat.completions.create(
            model=_openai_model,
            messages=[
                {"role": "system", "content": "You output only valid JSON. You filter skills to technical keywords only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=4096
        )
        output_text = response.choices[0].message.content.strip()
        technical_list = []
        try:
            parsed = json.loads(output_text)
            technical_list = [s.strip().lower() for s in parsed.get("technical_skills", []) if s and str(s).strip()]
        except json.JSONDecodeError:
            idx = output_text.find("technical_skills")
            if idx >= 0:
                arr_start = output_text.find("[", idx)
                if arr_start >= 0:
                    depth = 1
                    i = arr_start + 1
                    while i < len(output_text) and depth > 0:
                        if output_text[i] == "[":
                            depth += 1
                        elif output_text[i] == "]":
                            depth -= 1
                        i += 1
                    arr_str = output_text[arr_start:i]
                    try:
                        technical_list = json.loads(arr_str)
                        technical_list = [s.strip().lower() for s in technical_list if s and str(s).strip()]
                    except json.JSONDecodeError:
                        pass
        if not technical_list:
            return all_skills
        # Keep only all_skills that appear in technical_list (fuzzy: normalized match)
        kept = []
        for skill in all_skills:
            skill_lower = skill.lower().strip()
            if any(skill_lower in t or t in skill_lower or skill_lower == t for t in technical_list):
                kept.append(skill)
            elif any(_normalize_for_blocklist(skill) == _normalize_for_blocklist(t) for t in technical_list):
                kept.append(skill)
        if kept:
            print(f"Skill classifier: LLM technical filter kept {len(kept)}/{len(all_skills)} skills (model: {_openai_model})")
            return kept
        return all_skills
    except Exception as e:
        print(f"Skill classifier: Technical filter failed: {e}, using full skill list")
        return all_skills


def _classify_skills_with_openai(
    description: str,
    all_skills: List[str],
    requirements_text: str = ""
) -> Tuple[List[str], List[str]]:
    """
    Classify skills using OpenAI API (gpt-4o by default; set OPENAI_SKILL_MODEL for gpt-5.1 etc.).
    Outputs only proper technical keywords; excludes phrases like "communicate effectively",
    "governance", "software engineering".
    
    Args:
        description: Job description text
        all_skills: All skills to classify (e.g. from Sovren parser)
        requirements_text: Extracted requirements section (optional)
        
    Returns:
        Tuple of (must_skills, optional_skills)
    """
    if not all_skills:
        return [], []
    
    try:
        from openai import OpenAI
        import json
        
        # Initialize OpenAI client
        client = OpenAI(api_key=_openai_api_key)
        
        # Create prompt for LLM
        skills_list = ", ".join(all_skills[:50])  # Limit to 50 skills for prompt size
        requirements_section = f"\n\nRequirements Section:\n{requirements_text}" if requirements_text else ""
        prompt = f"""You are an expert ATS (Applicant Tracking System) job description analyzer specializing in technical skill classification.

## TASK
Analyze the job description and classify each skill from the candidate skills list as either MUST-HAVE (required) or OPTIONAL (nice-to-have).

## JOB DESCRIPTION
{description}{requirements_section}


## CLASSIFICATION CRITERIA

### MUST-HAVE Skills (Required):
- Skills explicitly stated as "required", "must have", "essential", "mandatory", "necessary"
- Skills mentioned in the "Requirements" or "Qualifications" section
- Core technical skills needed to perform primary job responsibilities
- Technologies/frameworks mentioned in the context of daily work or core duties
- Skills that appear multiple times throughout the description
- Skills implied by the job title or seniority level (e.g., "Senior Python Developer" → Python is must-have)
- Production-critical tools (CI/CD, monitoring, logging, deployment tools)
- Skills mentioned with strong language: "proficient in", "expertise in", "strong background in"

### OPTIONAL Skills (Nice-to-Have):
- Skills prefixed with "preferred", "nice to have", "bonus", "plus", "advantageous"
- Skills mentioned only in passing or as examples
- Skills that would enhance performance but aren't critical
- Emerging technologies mentioned as "familiarity with" or "exposure to"
- Skills listed in "Nice to Have" or "Bonus Points" sections

## SKILL NORMALIZATION RULES
1. Use canonical, lowercase skill names (e.g., "react" not "React.js" or "ReactJS")
2. Merge variations: "spring boot" = "springboot", "node.js" = "nodejs"
3. Map related terms to standard names: "diagnosing" → "troubleshooting", "debugging"
4. Keep original skill names from the candidate list - do not rename them
5. Match skills flexibly: "React" matches "react", "React.js", "ReactJS"

## EXCLUSION RULES — do NOT include these in either must_have or optional
Do not include these in either must_have or optional. Omit them entirely from your JSON; they must not appear in any list.
- Soft skills and general terms: "hygiene", "written communication", "verbal communication", "supportive", "collaboration", "teamwork", "leadership", "flexibility", "adaptability", "time management", "attention to detail", "critical thinking", "problem-solving" (when used as soft skill), "self-motivated", "proactive"
- Company values or culture: "team player", "passionate", "innovative"
- HR/legal: "right to work", "background check"
- Benefits: "health insurance", "remote work"
- Phrases: "communicate effectively", "getting stuff done", "performance oriented"
- Generic/vague: "governance", "software engineering", "product engineering", "software development", "r&d", "open-source", "system integration" (unless clearly a technical integration skill)
- Job actions: "managing teams" is not a skill
- Single vague nouns: "governance", "advantage"

## ANALYSIS PROCESS
1. Read the entire job description carefully
2. Identify the core responsibilities and requirements
3. For each candidate skill, determine:
   - Is it mentioned in the job description?
   - What context is it mentioned in? (requirements vs. nice-to-have)
   - How critical is it to the role?
4. Classify each skill based on the criteria above
5. Only output technical keywords in must_have and optional; omit non-keywords entirely (do not list them in optional).

## KEYWORD-ONLY RULE (CRITICAL)
Only include in "must_have" or "optional" items that are CONCRETE TECHNICAL KEYWORDS, e.g.:
- Programming languages: Python, Java, JavaScript, Go, etc.
- Frameworks/libraries: Django, Flask, React, Spring Boot, etc.
- Tools & platforms: Git, AWS, Azure, GCP, MongoDB, Docker, Kubernetes, CI/CD, RESTful APIs, etc.
- Methodologies (short): Agile, Scrum, Agile/Scrum.

Do NOT include in either must_have or optional (omit entirely from your JSON):
- Soft skills / general terms: "hygiene", "written communication", "supportive", "collaboration", "teamwork", "leadership", "flexibility", "adaptability", "time management", "attention to detail", "critical thinking", "problem-solving", "team player", "communicate effectively"
- Generic/vague: "governance", "software engineering", "product engineering", "r&d", "open-source", "system integration" (unless clearly a tech skill), "advantage"
If a candidate-skill is not a clear technical keyword (language, framework, tool, platform, protocol), omit it from both lists — do not list it under optional.

## OUTPUT FORMAT
Return ONLY a valid JSON object with no additional text, comments, or markdown formatting:

{{
  "must_have": ["skill1", "skill2", "skill3", ...],
  "optional": ["skill4", "skill5", ...]
}}

- Include as many must_have skills as are genuinely required (no fixed limit).
- Only classify skills that appear in the candidate skills list; match case-insensitively.
- If a candidate skill is not mentioned in the job description, put it in "optional".
- Return valid JSON only - no explanations, no markdown, no code blocks."""
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model=_openai_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that classifies job skills accurately. Always respond with valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.1,  # Low temperature for consistent classification
            max_tokens=4096   # No practical limit so must_skills list can be complete
        )
        
        output_text = response.choices[0].message.content.strip()
        
        # Parse JSON response
        # Extract JSON from response (handle cases where LLM adds extra text)
        json_match = re.search(r'\{[^{}]*"must_have"[^{}]*\{[^{}]*\}', output_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
        else:
            # Try to find JSON object
            json_match = re.search(r'\{.*"must_have".*"optional".*\}', output_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
            else:
                json_str = output_text
        
        # Clean up JSON string
        json_str = json_str.replace('\n', ' ').strip()
        
        try:
            parsed = json.loads(json_str)
            must_skills = [s.strip() for s in parsed.get('must_have', []) if s.strip()]
            optional_skills = [s.strip() for s in parsed.get('optional', []) if s.strip()]
            # Filter out non-keywords from LLM output
            must_skills = [s for s in must_skills if not is_non_keyword_skill(s)]
            optional_skills = [s for s in optional_skills if not is_non_keyword_skill(s)]
            
            # Normalize skill names to match input
            normalized_must = []
            normalized_optional = []
            
            for skill in all_skills:
                if is_non_keyword_skill(skill):
                    continue
                skill_lower = skill.lower()
                # Check if LLM output contains this skill (fuzzy match)
                found_in_must = any(skill_lower in s.lower() or s.lower() in skill_lower for s in must_skills)
                found_in_optional = any(skill_lower in s.lower() or s.lower() in skill_lower for s in optional_skills)
                
                if found_in_must:
                    normalized_must.append(skill)
                elif found_in_optional:
                    normalized_optional.append(skill)
                # If not found in LLM output, do not add to optional (skip; do not re-add non-keywords)
            
            # Backfill: only add unclassified skills to optional if they are technical keywords
            all_classified = set(normalized_must + normalized_optional)
            for skill in all_skills:
                if skill not in all_classified and not is_non_keyword_skill(skill):
                    normalized_optional.append(skill)
            
            print(f"Skill classifier: OpenAI LLM classified {len(normalized_must)} must-have and {len(normalized_optional)} optional skills")
            return normalized_must, normalized_optional
            
        except json.JSONDecodeError as e:
            print(f"Skill classifier: Failed to parse OpenAI JSON response: {e}")
            print(f"OpenAI Response: {output_text[:500]}")
            return [], []
            
    except Exception as e:
        print(f"Skill classifier: OpenAI LLM classification failed: {e}")
        import traceback
        traceback.print_exc()
        return [], []


def classify_skills_with_ml(job: Dict, openai_available: bool, description: str, sovren_fields: Dict, all_skills: List[str]) -> Tuple[List[str], List[str]]:
    """
    Classify skills using OpenAI LLM or fallback to keyword-based approach.
    
    Args:
        job: Job dictionary
        openai_available: Whether OpenAI API is available
        description: Job description text
        sovren_fields: Parsed Sovren fields
        all_skills: All skills to classify
        
    Returns:
        Tuple of (must_skills, optional_skills)
    """
    # Try OpenAI LLM-based classification first
    if openai_available:
        requirements_text = " ".join(sovren_fields.get("requirements", []))
        must_skills, optional_skills = _classify_skills_with_openai(
            description,
            all_skills,
            requirements_text
        )
        
        if must_skills or optional_skills:
            return must_skills, optional_skills
    
    # Fallback to keyword-based classification
    must_skills = []
    optional_skills = []
    
    skill_scores = []
    for skill in all_skills:
        score = calculate_skill_requirement_score(skill, description, sovren_fields, openai_available)
        skill_scores.append((skill, score))
    
    # Sort by score descending
    skill_scores.sort(key=lambda x: x[1], reverse=True)
    
    # Classify skills based on score
    # Threshold: >= 0.65 = must-have, < 0.65 = optional
    # Lower threshold to better catch technical skills
    threshold = 0.65
    
    # Special handling for technical skills in requirements
    requirements_text = " ".join(sovren_fields.get("requirements", [])).lower()
    classified_skills = set()  # Track already classified skills
    
    for skill, score in skill_scores:
        if skill in classified_skills:
            continue
            
        skill_lower = skill.lower()
        is_tech = is_technical_skill(skill)
        
        # Technical skills in requirements are almost always must-have
        if is_tech and skill_lower in requirements_text:
            must_skills.append(skill)
            classified_skills.add(skill)
            continue
        
        # Use threshold-based classification
        if score >= threshold:
            must_skills.append(skill)
            classified_skills.add(skill)
        else:
            # Even if below threshold, technical skills with decent scores might be required
            if is_tech and score >= 0.5:
                # Technical skill with decent score = likely must-have
                must_skills.append(skill)
                classified_skills.add(skill)
            else:
                optional_skills.append(skill)
                classified_skills.add(skill)
    
    # Adjust threshold if we have very few must skills (fallback)
    if not must_skills and skill_scores:
        high_score_skills = [s for s, score in skill_scores if score >= 0.5]
        if high_score_skills:
            # Use top skills as must-have (clear and rebuild)
            must_skills.clear()
            optional_skills.clear()
            threshold = 0.5
            for skill, score in skill_scores:
                if score >= threshold:
                    must_skills.append(skill)
                else:
                    optional_skills.append(skill)
    
    return must_skills, optional_skills


def extract_experience_from_text(text: str) -> Optional[int]:
    """
    Extract years of experience from text using pattern matching.
    
    Patterns: "3+ years", "5 years", "minimum 3 years", "at least 3 years", "3-5 years"
    
    Args:
        text: Text to search for experience patterns
        
    Returns:
        Integer years of experience or None if not found
    """
    if not text or not isinstance(text, str):
        return None
    
    text_lower = text.lower()
    
    # Pattern 1: "X+ years" or "X+ years of experience"
    match = re.search(r'(\d+)\+\s*(?:years|yrs|yr)\s*(?:of\s*experience)?', text_lower)
    if match:
        return int(match.group(1))
    
    # Pattern 2: "minimum X years" or "at least X years"
    match = re.search(r'(?:minimum|at least|min)\s+(\d+)\s*(?:years|yrs|yr)', text_lower)
    if match:
        return int(match.group(1))
    
    # Pattern 3: "X years" or "X years of experience"
    match = re.search(r'(\d+)\s*(?:years|yrs|yr)\s*(?:of\s*experience)?', text_lower)
    if match:
        return int(match.group(1))
    
    # Pattern 4: "X-Y years" (take the minimum)
    match = re.search(r'(\d+)[-–]\d+\s*(?:years|yrs|yr)', text_lower)
    if match:
        return int(match.group(1))
    
    return None


def classify_skills_from_job(job: Dict) -> Dict:
    """
    Classify skills from job description into must (required) and optional categories.
    Also extracts experience requirements.
    
    Uses OpenAI API (gpt-4o by default; set OPENAI_SKILL_MODEL for gpt-5.1 etc.) for keyword-only must/optional skill classification.
    Falls back to keyword-based approach if OpenAI API is unavailable.
    
    Args:
        job: Job dictionary with fields like 'description', 'skills', 'company_keywords', 'seniority'
        
    Returns:
        Dictionary with:
        {
            "must_skills": List[str],
            "optional_skills": List[str],
            "experience_years": Optional[int],
            "experience_level": Optional[str]
        }
    """
    must_skills = []
    optional_skills = []
    experience_years = None
    experience_level = None
    
    # Get job description
    description = job.get("description", "")
    if not description:
        description = ""
    
    # Get existing skills from job data (raw, before normalization)
    existing_skills_raw = []
    if job.get("skills"):
        if isinstance(job["skills"], list):
            existing_skills_raw = [str(s).strip() for s in job["skills"] if s]
        elif isinstance(job["skills"], str):
            existing_skills_raw = [s.strip() for s in job["skills"].split(",") if s.strip()]
    
    if job.get("company_keywords"):
        if isinstance(job["company_keywords"], list):
            existing_skills_raw.extend([str(s).strip() for s in job["company_keywords"] if s])
        elif isinstance(job["company_keywords"], str):
            existing_skills_raw.extend([s.strip() for s in job["company_keywords"].split(",") if s.strip()])
    
    # Normalize and deduplicate skills to handle variations like "springboot" vs "spring-boot"
    existing_skills, skill_mapping = deduplicate_skills(existing_skills_raw)
    
    # Parse job description with sovren to extract structured data
    sovren_fields = {
        "skills": [],
        "requirements": [],
        "responsibilities": [],
    }
    
    if description and description.strip():
        try:
            parsed_data = parse_job_description_from_string(description)
            sovren_fields = extract_all_fields_from_parsed_data(parsed_data)
        except Exception as e:
            print(f"Skill classifier: Sovren parsing failed: {e}")
    
    # Combine all skills (normalized existing + sovren-extracted)
    all_skills = existing_skills.copy()
    sovren_skills = sovren_fields.get("skills", [])
    for skill in sovren_skills:
        skill_normalized = normalize_skill_name(skill)
        if skill_normalized and skill_normalized not in all_skills:
            all_skills.append(skill_normalized)
            # Add to mapping if not already there
            if skill_normalized not in skill_mapping:
                skill_mapping[skill_normalized] = skill.strip()
    
    # Try OpenAI LLM-based classification first
    openai_available = _check_openai_available()
    ml_classification_used = False
    
    # Pre-filter to technical keywords only via LLM (same model as classifier; set OPENAI_SKILL_MODEL=gpt-5.1 for best results)
    if openai_available and all_skills:
        all_skills = _filter_technical_skills_with_openai(all_skills)
    
    if openai_available and all_skills and description:
        try:
            ml_must, ml_optional = classify_skills_with_ml(job, openai_available, description, sovren_fields, all_skills)
            
            # Use OpenAI classification if we got reasonable results
            if ml_must or ml_optional:
                must_skills = ml_must
                optional_skills = ml_optional
                ml_classification_used = True
                print(f"Skill classifier: Used OpenAI LLM-based classification ({_openai_model})")
        except Exception as e:
            print(f"Skill classifier: OpenAI LLM classification failed: {e}, falling back to keyword-based approach")
    
    # Fallback 1: Use Sovren requirements section if ML didn't work or returned empty
    # Fallback 1: Enhanced keyword-based classification when ML is not available
    if not ml_classification_used:
        description_lower = description.lower() if description else ""
        
        # Score each skill based on keyword analysis
        skill_scores = []
        for skill in all_skills:
            skill_lower = skill.lower().strip()
            score = 0.0
            
            # Find all mentions of this skill in description
            skill_mentions = find_skill_mentions(skill, description)
            
            if not skill_mentions:
                # Skill not mentioned in description - likely optional
                skill_scores.append((skill, 0.0))
                continue
            
            # Check each mention for requirement keywords
            for _, _, context in skill_mentions[:5]:  # Check up to 5 mentions
                context_lower = context.lower()
                
                # Check for must-have keywords in context
                has_must, has_preferred, ctx_score = detect_requirement_keywords(context)
                
                if has_must:
                    score = max(score, 1.0)  # Must-have keyword found
                elif has_preferred:
                    score = max(score, 0.3)  # Preferred keyword found
                else:
                    # No explicit keywords, use positional scoring
                    if context_lower in description_lower:
                        # Check if in requirements section
                        req_text = " ".join(sovren_fields.get("requirements", [])).lower()
                        if skill_lower in req_text:
                            score = max(score, 0.8)  # In requirements section
                        else:
                            # Check if technical skill (more likely to be required)
                            if is_technical_skill(skill):
                                score = max(score, 0.6)  # Technical skill mentioned
                            else:
                                score = max(score, 0.4)  # Mentioned but not in requirements
            
            # Boost score for technical skills in requirements
            if is_technical_skill(skill):
                req_text = " ".join(sovren_fields.get("requirements", [])).lower()
                if skill_lower in req_text:
                    score = max(score, 0.85)  # Technical skill in requirements = must-have
            
            # Frequency bonus (more mentions = more important)
            mention_count = len(skill_mentions)
            if mention_count > 1:
                score = min(1.0, score + (mention_count - 1) * 0.1)
            
            skill_scores.append((skill, score))
        
        # Sort skills by score (descending)
        skill_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Classify based on score
        # Threshold: >= 0.6 = must-have, < 0.6 = optional
        threshold = 0.6
        
        for skill, score in skill_scores:
            if score >= threshold:
                if skill not in must_skills:
                    must_skills.append(skill)
            else:
                if skill not in optional_skills:
                    optional_skills.append(skill)
        
        # If we still have no must skills, use adaptive threshold
        if not must_skills and skill_scores:
            # Find the highest score
            max_score = skill_scores[0][1] if skill_scores else 0.0
            
            if max_score > 0.0:
                # Use 70% of max score as threshold
                adaptive_threshold = max_score * 0.7
                # Reclassify
                must_skills.clear()
                optional_skills.clear()
                
                for skill, score in skill_scores:
                    if score >= adaptive_threshold:
                        must_skills.append(skill)
                    else:
                        optional_skills.append(skill)
        
        # Ensure we have at least some must skills if we have skills
        if not must_skills and skill_scores:
            # Take top 30% as must skills (minimum 1)
            num_must = max(1, int(len(skill_scores) * 0.3))
            must_skills = [s for s, _ in skill_scores[:num_must]]
            optional_skills = [s for s, _ in skill_scores[num_must:]]
    
    # Fallback 2: If still no must skills found, use requirements section analysis
    if not must_skills and all_skills and sovren_fields.get("requirements"):
        req_text = " ".join(sovren_fields["requirements"]).lower()
        
        # Rank skills by first mention position in requirements
        skill_positions = []
        for skill in all_skills:
            skill_lower = skill.lower()
            pos = req_text.find(skill_lower)
            if pos >= 0:
                skill_positions.append((skill, pos))
        
        # Sort by position (earlier = more important)
        skill_positions.sort(key=lambda x: x[1])
        
        # First 40% of skills mentioned in requirements = must skills
        if skill_positions:
            split_point = max(1, int(len(skill_positions) * 0.4))
            must_skills = [s for s, _ in skill_positions[:split_point]]
            optional_skills.extend([s for s, _ in skill_positions[split_point:]])
    
    # Fallback 3: Last resort - use intelligent heuristic based on technical skills
    if not must_skills and existing_skills:
        # Prioritize technical skills as must-have
        technical_skills = [s for s in existing_skills if is_technical_skill(s)]
        non_technical_skills = [s for s in existing_skills if not is_technical_skill(s)]
        
        # Technical skills are more likely to be must-have
        if technical_skills:
            # Take all technical skills as must, or at least 50% if too many
            if len(technical_skills) <= len(existing_skills) * 0.6:
                must_skills = technical_skills
                optional_skills = non_technical_skills
            else:
                # Too many technical skills, take first 50%
                split_point = max(1, int(len(technical_skills) * 0.5))
                must_skills = technical_skills[:split_point]
                optional_skills = technical_skills[split_point:] + non_technical_skills
        else:
            # No technical skills, use first 40% heuristic
            split_point = max(1, int(len(existing_skills) * 0.4))
            must_skills = existing_skills[:split_point]
            optional_skills = existing_skills[split_point:]
        
        print(f"Skill classifier: Using intelligent keyword-based classification (no ML model available)")
        
    # Remove duplicates from optional_skills (skills that are already in must_skills)
    optional_skills = [s for s in optional_skills if s not in must_skills]
    
    # Extract experience from description
    if description:
        experience_years = extract_experience_from_text(description)
    
    # Also check requirements text for experience
    if not experience_years and sovren_fields.get("requirements"):
        req_text = " ".join(sovren_fields["requirements"])
        experience_years = extract_experience_from_text(req_text)
    
    # Fallback to seniority field for experience level
    experience_level = job.get("seniority") or job.get("experience_level")
    
    # If we have seniority but no years, try to infer
    if not experience_years and experience_level:
        seniority_lower = str(experience_level).lower()
        if "senior" in seniority_lower:
            experience_years = 5  # Assume senior = 5+ years
        elif "mid" in seniority_lower or "intermediate" in seniority_lower:
            experience_years = 3  # Assume mid = 3+ years
        elif "junior" in seniority_lower or "entry" in seniority_lower:
            experience_years = 1  # Assume junior = 1+ years
    
    # Map normalized skills back to original names for display
    must_skills_original = [skill_mapping.get(skill, skill) for skill in must_skills if skill in skill_mapping or skill not in skill_mapping]
    optional_skills_original = [skill_mapping.get(skill, skill) for skill in optional_skills if skill in skill_mapping or skill not in skill_mapping]
    
    # If mapping doesn't have the skill, use the skill as-is (for sovren skills that weren't in mapping)
    for skill in must_skills:
        if skill not in skill_mapping:
            must_skills_original.append(skill)
    for skill in optional_skills:
        if skill not in skill_mapping:
            optional_skills_original.append(skill)
    
    # Remove duplicates while preserving order
    seen_must = set()
    must_skills_final = [s for s in must_skills_original if s not in seen_must and not seen_must.add(s)]
    seen_opt = set()
    optional_skills_final = [s for s in optional_skills_original if s not in seen_opt and not seen_opt.add(s)]
    
    # Choke-point filter: remove non-keywords from both lists (never appear in must or optional)
    must_skills_final = [s for s in must_skills_final if not is_non_keyword_skill(s)]
    optional_skills_final = [s for s in optional_skills_final if not is_non_keyword_skill(s)]
    
    print(f"Skill classifier - Must skills: {len(must_skills_final)}, Optional skills: {len(optional_skills_final)}, Experience: {experience_years} years")
    
    return {
        "must_skills": must_skills_final,
        "optional_skills": optional_skills_final,
        "experience_years": experience_years,
        "experience_level": experience_level
    }


def generate_skills_from_headline(headline: str = None, title: str = None) -> List[str]:
    if not _check_openai_available():
        return []
    
    context = headline or title
    if not context:
        return []
    
    try:
        from openai import OpenAI
        import json
        import re
        
        client = OpenAI(api_key=_openai_api_key)
        
        # STRENGTHENED PROMPT: Focus on "Noun Phrases" and "Conciseness"
        prompt = f"""Role: "{context}"
Generate exactly 4 skills.
Constraints:
- Format: Single words or short technical phrases only (e.g., 'Python', not 'Proficient in Python').
- No sentences, no verbs, no introductory filler.
- Focus: Technical tools, frameworks, and core industry competencies.
- Return ONLY a JSON array of strings."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a database of technical keywords. You only output concise, 1-3 word skill tags in a JSON list."},
                {"role": "user", "content": prompt}
            ],
            # JSON mode helps keep it structured, but we still need to handle the content
            response_format={ "type": "json_object" },
            temperature=0.3, # Lowered to 0.3 to reduce "creativity" and verbosity
            max_tokens=60
        )
        
        content = response.choices[0].message.content.strip()
        data = json.loads(content)
        
        # Handle cases where GPT returns {"skills": ["Java", "Python"]} 
        # instead of just ["Java", "Python"]
        if isinstance(data, dict):
            skills_list = next(iter(data.values())) if isinstance(next(iter(data.values())), list) else []
        else:
            skills_list = data

        # Final cleanup: Strip any remaining "Experience in" or "Knowledge of" just in case
        cleaned_skills = []
        for s in skills_list:
            # Remove common "sentence-making" prefixes if they leak through
            s = re.sub(r'^(Proficient in|Expertise in|Experience with|Knowledge of|Familiarity with|Strong|Expert)\s+', '', str(s), flags=re.IGNORECASE)
            cleaned_skills.append(s.strip().title()) # .title() keeps it looking like a tag

        return cleaned_skills[:4]
            
    except Exception as e:
        print(f"Skill generation failed: {e}")
        return []