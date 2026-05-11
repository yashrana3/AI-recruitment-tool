export interface JobPostingTypes {
  id: string;
  job_id?: string; // Some APIs return job_id separately
  scheduler_id?: string; // Scheduler ID for tracking which scheduler created this job
  created_at: string | null; // ISO datetime string
  location: string;
  country: string;
  title: string;
  description: string;
  seniority: "Intern" | "Junior" | "Mid-Senior level" | "Senior" | string;
  job_url: string;
  company_name: string;
  company_website: string;
  company_industry: string;
  company_keywords: string[];
  skills?: string[]; // Skills extracted from job
  email: string | null;
}

