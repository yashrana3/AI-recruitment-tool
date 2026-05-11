import { JobPostingTypes } from "../lib/type";
import axiosClient from "./axiosClient";

export interface JobApiParams {
  q?: string; // query parameter
  limit?: number; // limit parameter
  offset?: number; // offset parameter for pagination
}

export interface MatchResumesParams {
  limit: number;
  job_id: string;
}

export interface MatchCandidateParams {
  job_id: string;
  resume_id: string;
  score: number;
}

interface MatchResumesResponse {
  message?: string;
  resume?: Array<{
    id?: number;
    full_name?: string;
    location_full?: string;
    email?: string;
    title?: string;
    score?: number;
    scoring_breakdown?: {
      job_title_score?: number;
      skills_score?: number;
      must_skills_matched?: number;
      must_skills_total?: number;
      optional_skills_matched?: number;
      optional_skills_total?: number;
      location_score?: number;
      experience_score?: number;
      total_score: number;
      preference: "job_title" | "skills";
    };
  }>;
}

export const getJobs = async (
  params?: JobApiParams
): Promise<{ count: number; jobs: JobPostingTypes[]; offset: number; limit: number }> => {
  try {
    const response = await axiosClient.get("/api/jobs", {
      params: params
        ? {
          q: params.q,
          limit: params.limit,
          offset: params.offset,
        }
        : {},
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching jobs:", error);
    throw error;
  }
};

export interface ExtractResumeRequest {
  limit?: number;
  job_id: string;
  preference?: "job_title" | "skills";
}

export const matchExtractApolloResumes = async (
  params: ExtractResumeRequest
): Promise<MatchResumesResponse> => {
  try {
    const response = await axiosClient.post(
      "/api/match/extract/resumes/apollo",
      {
        limit: params.limit,
        job_id: params.job_id,
        preference: params.preference || "skills",
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error matching resumes:", error);
    throw error;
  }
};

export const matchExtractCoresignalResumes = async (
  params: ExtractResumeRequest
): Promise<MatchResumesResponse> => {
  try {
    const response = await axiosClient.post(
      "/api/match/extract/resumes/coresignal",
      {
        limit: params.limit,
        job_id: params.job_id,
        preference: params.preference || "skills",
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error matching resumes:", error);
    throw error;
  }
};

export const matchExtractResumesFromDatabase = async (
  params: ExtractResumeRequest
): Promise<MatchResumesResponse> => {
  try {
    const response = await axiosClient.post(
      "/api/match/resumes/database",
      {
        job_id: params.job_id,
        preference: params.preference || "skills",
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error matching resumes from database:", error);
    throw error;
  }
};

export const matchCandidate = async (
  params: MatchCandidateParams
): Promise<any> => {
  try {
    const response = await axiosClient.post("/api/match", {
      job_id: params.job_id,
      resume_id: params.resume_id,
      score: params.score,
    });
    return response.data;
  } catch (error) {
    console.error("Error matching candidate:", error);
    throw error;
  }
};

export interface GetMatchedParams {
  offset?: number; // skip
  limit?: number; // max results (default 10)
}

export const getMatched = async (params?: GetMatchedParams): Promise<any> => {
  try {
    const response = await axiosClient.get("/api/matched", {
      params: {
        offset: params?.offset || 0,
        limit: params?.limit || 10,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching matched jobs:", error);
    throw error;
  }
};

export interface SchedulerRun {
  run_id?: number;
  executed_at: string | null;
  jobs_fetched: number;
  has_error: boolean;
  error_message: string | null;
  execution_time_seconds: number | null;
  // Computed on the frontend using /api/scheduler-runs/{run_id}/jobs
  computed_jobs_fetched?: number;
}

export interface SchedulerData {
  scheduler_id: string;
  api_name: string;
  interval_type?: string;
  is_active: boolean | string;
  last_run: string;
  next_run: string;
  created_at?: string;
  total_jobs_fetched?: number;
  jobs_fetched?: number; // For backward compatibility
  execution_history?: SchedulerRun[];
  payload_json?: string;
}

export interface SchedulersResponse {
  schedulers: SchedulerData[];
  total: number;
  limit: number;
  offset: number;
}

export const getSchedulers = async (
  limit: number = 10,
  offset: number = 0
): Promise<SchedulersResponse> => {
  try {
    const response = await axiosClient.get("/api/schedulers", {
      params: { limit, offset }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching schedulers:", error);
    throw error;
  }
};

export const startScheduler = async (schedulerId: string): Promise<any> => {
  try {
    const response = await axiosClient.post(`/api/scheduler/${schedulerId}/start`);
    return response.data;
  } catch (error) {
    console.error("Error starting scheduler:", error);
    throw error;
  }
};

export const stopScheduler = async (schedulerId: string): Promise<any> => {
  try {
    const response = await axiosClient.post(`/api/scheduler/${schedulerId}/stop`);
    return response.data;
  } catch (error) {
    console.error("Error stopping scheduler:", error);
    throw error;
  }
};

export const getSchedulerRuns = async (schedulerId: string, limit: number = 10): Promise<{ scheduler_id: string; runs: SchedulerRun[]; count: number }> => {
  try {
    const response = await axiosClient.get(`/api/scheduler/${schedulerId}/runs`, {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching scheduler runs:", error);
    throw error;
  }
};

export interface JobData {
  id: string;
  title: string;
  company_name: string;
  company_website: string | null;
  company_industry: string | null;
  location: string;
  country: string;
  seniority: string | null;
  description: string;
  job_url: string;
  email: string | null;
  created_at: string | null;
  company_keywords: string | null;
  credits_remaining: string | null;
}

export interface SchedulerRunJobsResponse {
  run_id: number;
  scheduler_id: number;
  executed_at: string | null;
  jobs_fetched: number;
  jobs: JobData[];
  total_jobs: number;
}

export const getSchedulerRunJobs = async (runId: number): Promise<SchedulerRunJobsResponse> => {
  try {
    const response = await axiosClient.get(`/api/scheduler-runs/${runId}/jobs`);
    return response.data;
  } catch (error) {
    console.error("Error fetching scheduler run jobs:", error);
    throw error;
  }
};


export const deleteScheduler = async (schedulerId: string): Promise<any> => {
  try {
    const response = await axiosClient.delete(`/api/scheduler/${schedulerId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting scheduler:", error);
    throw error;
  }
};

export interface ResumeData {
  id: string;
  linkedin_url: string;
  full_name: string;
  headline: string;
  summary: string | string[];
  location_country: string;
  location_full: string[];
  skills: string[];
  email: string;
  title: string;
  experience: string;
}

export interface GetResumesResponse {
  count: number;
  resumes: ResumeData[];
  offset: number;
  limit: number;
}

export interface GetResumesParams {
  offset?: number;
  limit?: number;
  q?: string; // search query
}

export const getResumes = async (
  params?: GetResumesParams
): Promise<GetResumesResponse> => {
  try {
    const response = await axiosClient.get("/api/resumes", {
      params: {
        offset: params?.offset || 0,
        limit: params?.limit || 10,
        q: params?.q,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching resumes:", error);
    throw error;
  }
};

export interface DeleteResumeResponse {
  message: string;
  resume_id: string;
  resume_name: string | null;
  resume_email: string | null;
  matched_records_deleted: number;
}

export const deleteResume = async (resumeId: string): Promise<DeleteResumeResponse> => {
  try {
    const response = await axiosClient.delete(`/api/resumes/${resumeId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error deleting resume:", error);
    throw error;
  }
};

export const deleteJob = async (jobId: string): Promise<any> => {
  try {
    const response = await axiosClient.delete(`/api/jobs/${jobId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting job:", error);
    throw error;
  }
};

export interface CoresignalsParams {
  limit: number;
  max_age_days: number;
  city?: string;
  country_code?: string[];
  skills: string[];
  logic?: "or" | "and";
}

export interface CoresignalsResponse {
  message: string;
  jobs?: any[];
}

export const createCoresignalsScheduler = async (
  params: CoresignalsParams
): Promise<CoresignalsResponse> => {
  try {
    const response = await axiosClient.post("/api/create/jobs/coresignals", {
      limit: params.limit,
      max_age_days: params.max_age_days,
      city: params.city,
      country_code: params.country_code,
      skills: params.skills,
      logic: params.logic,
    });

    return response.data;
  } catch (error) {
    console.error("Error creating coresignals scheduler:", error);
    throw error;
  }
};

export interface TechnologyMapping {
  keyword: string;
  slug: string;
}

export interface GetMappingsParams {
  q?: string;
  limit?: number;
  datapoint: string;
}

export const getMappings = async (
  params: GetMappingsParams
): Promise<TechnologyMapping[]> => {
  try {
    const response = await axiosClient.get("/mappings", {
      params: {
        q: params.q,
        limit: params.limit || 20,
        datapoint: params.datapoint,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching mappings:", error);
    throw error;
  }
};

// Alias for backward compatibility
export const getTechnologyMappings = getMappings;

export interface CreateMappingRequest {
  raw: string; // Only raw (skill name) is required, mapped (slug) is auto-generated
}

export interface CreateMappingResponse {
  message: string;
  id: number;
  datapoint: string;
  raw: string;
  mapped: string;
}

export const createMapping = async (
  params: CreateMappingRequest
): Promise<CreateMappingResponse> => {
  try {
    const response = await axiosClient.post("/api/mappings", {
      raw: params.raw,
    });
    return response.data;
  } catch (error) {
    console.error("Error creating mapping:", error);
    throw error;
  }
};

export interface TheirstackParams {
  limit: number;
  max_age_days: number;
  location_pattern?: string[];
  job_technology_slug?: string[];
  job_country_code_or?: string[];
  industry_id_or?: number[];
  logic?: string;
}

export interface TheirstackResponse {
  message: string;
  jobs?: any[];
}

export const createTheirstackScheduler = async (
  params: TheirstackParams
): Promise<TheirstackResponse> => {
  try {
    const response = await axiosClient.post("/api/create/jobs/theirstack", {
      limit: params.limit,
      max_age_days: params.max_age_days,
      location_pattern: params.location_pattern || [],
      job_technology_slug: params.job_technology_slug || [],
      job_country_code_or: params.job_country_code_or || [],
      industry_id_or: params.industry_id_or || [],
      logic: params.logic || "or",
    });
    return response.data;
  } catch (error) {
    console.error("Error creating theirstack scheduler:", error);
    throw error;
  }
};

// src/api/DashBoard.API.ts
// Replace the existing MantiksParams interface (around line 265-269)

export interface MantiksParams {
  limit: number;
  job_age_in_days: number;
  job_location_ids: number[];
}

export interface MantiksResponse {
  message: string;
  jobs?: any[];
}

export const createMantiksScheduler = async (
  params: MantiksParams
): Promise<MantiksResponse> => {
  try {
    const response = await axiosClient.post("/api/create/jobs/mantiks", {
      limit: params.limit,
      job_age_in_days: params.job_age_in_days,
      job_location_ids: params.job_location_ids,
    });
    return response.data;
  } catch (error) {
    console.error("Error creating mantiks scheduler:", error);
    throw error;
  }
};

// Unified Scheduler API (uses scheduler flow)
export interface UnifiedSchedulerParams {
  api_name: "coresignal" | "theirstack" | "mantiks";
  interval: "1hr" | "2hr" | "4hr" | "6hr" | "12hr" | "daily" | "weekly";
  limit: number;
  // CoreSignal fields
  city?: string;
  country?: string;
  skills?: string[];
  logic?: "or" | "and";
  // TheirStack fields
  max_age_days?: number;
  location_pattern?: string[];
  job_technology_slug?: string[];
  job_country_code_or?: string[];
  industry_id_or?: number[];
  employment_statuses?: string[];  // TheirStack employment status filter
  // Mantiks fields
  job_age_in_days?: number;
  job_location_ids?: number[];
  job_description?: string[];  // Used for skills in Mantiks
}

export interface UnifiedSchedulerResponse {
  success: boolean;
  message: string;
  scheduler_id: string;
  api_name?: string;
  jobs_fetched: number;
  initial_jobs_fetched?: number; // Keep for backward compatibility
  has_error?: boolean;
  error_type?: "api_error" | "network_error" | "validation_error" | "no_results" | "unknown_error";
  error_message?: string;
  error_details?: any;
  warning?: string;
  next_run?: string;
  jobs?: any[];
}

export const createUnifiedScheduler = async (
  params: UnifiedSchedulerParams
): Promise<UnifiedSchedulerResponse> => {
  try {
    // Extract api_name and interval at top level, put the rest in payload
    const { api_name, interval, ...payload } = params;

    const requestBody = {
      api_name,
      interval,
      payload,
    };

    console.log("Sending scheduler request:", requestBody);
    const response = await axiosClient.post("/api/scheduler/create", requestBody);
    return response.data;
  } catch (error) {
    console.error("Error creating unified scheduler:", error);
    throw error;
  }
};

export interface UpdateSchedulerPayloadRequest {
  limit?: number;
  interval?: "1hr" | "2hr" | "4hr" | "6hr" | "12hr" | "daily" | "weekly";
  skills?: string[];

  // Location fields (varies by API)
  city?: string;
  country?: string;
  location_pattern?: string[];
  job_country_code_or?: string[];
  job_location_ids?: number[];
}

export const updateSchedulerPayload = async (
  schedulerId: string,
  payload: UpdateSchedulerPayloadRequest
): Promise<any> => {
  try {
    const response = await axiosClient.put(`/api/scheduler/${schedulerId}/update`, payload);
    return response.data;
  } catch (error) {
    console.error("Error updating scheduler:", error);
    throw error;
  }
};

export interface TheirStackCreditsResponse {
  credits_remaining: number;
  credits_used: number;
  credits_total: number;
  api_name: string;
}

export const getTheirstackCredits = async (): Promise<TheirStackCreditsResponse> => {
  try {
    const response = await axiosClient.get("/api/theirstack/credits");
    return response.data;
  } catch (error) {
    console.error("Error fetching TheirStack credits:", error);
    throw error;
  }
};

export interface MantiksCreditsResponse {
  credits_remaining: number | null;
  credits_used: number | null;
  credits_total: number | null;
  api_name: string;
  last_updated?: string | null;
  message?: string;
}

export const getMantiksCredits = async (): Promise<MantiksCreditsResponse> => {
  try {
    const response = await axiosClient.get("/api/mantiks/credits");
    return response.data;
  } catch (error) {
    console.error("Error fetching Mantiks credits:", error);
    throw error;
  }
};

export interface CoreSignalCreditsResponse {
  api_name: string;
  search_credits_remaining: number | null;
  collect_credits_remaining: number | null;
  search_last_updated?: string | null;
  collect_last_updated?: string | null;
  message?: string;
}

export const getCoresignalCredits = async (): Promise<CoreSignalCreditsResponse> => {
  try {
    const response = await axiosClient.get("/api/coresignal/credits");
    return response.data;
  } catch (error) {
    console.error("Error fetching CoreSignal credits:", error);
    throw error;
  }
};

export interface UploadResumeResponse {
  message: string;
  total_rows: number;
  saved: number;
  duplicates: number;
  invalid: number;
  invalid_rows?: Array<{
    row: number;
    error: string;
  }> | null;
  sheets_processed: Array<{
    sheet_name: string;
    rows: number;
    columns?: number;
  }>;
  column_mapping: {
    mapped_columns: Record<string, string>;
    available_columns: string[];
    unmapped_columns: string[];
  };
}

// Add Sovren credits interface and function

export interface SovrenCreditsResponse {
  api_name: string;
  credits_remaining: number | null;
  last_updated?: string | null;
  message?: string;
}

export const getSovrenCredits = async (): Promise<SovrenCreditsResponse> => {
  const response = await axiosClient.get("/api/sovren/credits");
  return response.data;
};


export const uploadResumes = async (
  file: File,
  sheetName?: string
): Promise<UploadResumeResponse> => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (sheetName) {
      formData.append("sheet_name", sheetName);
    }

    const response = await axiosClient.post("/api/upload/resumes", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error: any) {
    console.error("Error uploading resumes:", error);
    throw error;
  }
};