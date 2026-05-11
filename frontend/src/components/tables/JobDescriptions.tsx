import { useEffect, useState } from "react";
import MatchingCandidatesModal from "./MatchingCandidatesModal";
import ReactMarkdown from "react-markdown";

import {
  getJobs,
  matchExtractApolloResumes,
  matchExtractCoresignalResumes,
  matchExtractResumesFromDatabase,
  deleteJob,
} from "../../api/DashBoard.API";
import { JobPostingTypes } from "../../lib/type";
import { Eye, Trash2 } from "lucide-react";
import Select from "../form/Select";
import { useUserRole } from "../../hooks/useUserRole";

interface Candidate {
  id: number;
  name: string;
  place: string;
  email: string;
  position: string;
  matchPercentage: number;
  experience?: number;
  hasAllMustSkills?: boolean;
  scoringBreakdown?: {
    job_title_score?: number;
    skills_score?: number;
    must_skills_matched?: number;
    must_skills_total?: number;
    optional_skills_matched?: number;
    optional_skills_total?: number;
    all_skills_matched?: number;
    all_skills_total?: number;
    location_score?: number;
    experience_score?: number;
    total_score: number;
    preference: "job_title" | "skills";
  } | null;
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
    experience?: number;
    skills?: string[];
  }>;
}

export default function JobDescriptions() {
  const { isAdmin, isViewer } = useUserRole();
  const [jobs, setJobs] = useState<JobPostingTypes[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false); // Separate state for job fetching
  const [isProcessing, setIsProcessing] = useState(false); // Separate state for data extraction/processing
  const [selectedAction, setSelectedAction] = useState<
    "local" | "extract" | "database" | null
  >(null);
  const [selectedJob, setSelectedJob] = useState<JobPostingTypes | null>(null);

  const [showViewModal, setShowViewModal] = useState(false);
  const [viewJob, setViewJob] = useState<JobPostingTypes | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedSource, setSelectedSource] = useState<"apollo" | "coresignal">(
    "apollo"
  );
  const [matchingPreference, setMatchingPreference] = useState<"job_title" | "skills">(
    "skills"
  );
  const [modalJob, setModalJob] = useState<JobPostingTypes | null>(null); // Store job for modal separately
  const [noResultsMessage, setNoResultsMessage] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setIsLoadingJobs(true); // Use separate state
        const offset = (currentPage - 1) * itemsPerPage;
        const data = await getJobs({
          limit: itemsPerPage,
          offset: offset,
        });
        const jobsArray = Array.isArray(data.jobs) ? data.jobs : [];
        setJobs(jobsArray);
        setTotalCount(data.count || 0);
      } catch (err) {
        console.error("Error fetching jobs:", err);
        setJobs([]);
        setTotalCount(0);
      } finally {
        setIsLoadingJobs(false); // Use separate state
      }
    };

    fetchJobs();
    const interval = setInterval(fetchJobs, 35000);
    return () => clearInterval(interval);
  }, [currentPage, itemsPerPage]);

  const handleDeleteJob = async (job: JobPostingTypes) => {
    if (isViewer) {
      alert("Viewers do not have access to delete jobs. Please contact an administrator.");
      return;
    }
  
    const jobId = job.id; // backend uses /api/jobs/{job_id} where job_id == job.id in DB
    if (!jobId) return;
  
    if (!confirm(`Delete job "${job.title}"?`)) return;
  
    try {
      await deleteJob(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (e) {
      console.error("Delete job failed:", e);
      alert("Failed to delete job. Please try again.");
    }
  };


  const handleSourceClick = (job: JobPostingTypes) => {
    if (isViewer) {
      alert("Viewers do not have access to match resumes. Please contact an administrator.");
      return;
    }
    // Log the job object to debug ID issues
    console.log("Selected job for Source:", {
      id: job.id,
      job_id: job.job_id,
      title: job.title,
      fullObject: job,
    });
    setSelectedJob(job);
  };

  const handleActionSelect = async (action: "local" | "extract" | "database") => {
    setSelectedAction(action);

    if (action === "database" && selectedJob) {
      setIsProcessing(true);

      try {
        const jobId = selectedJob.job_id || selectedJob.id;
        console.log("Running database match for job ID:", jobId);

        const response = await matchExtractResumesFromDatabase({
          job_id: jobId,
          preference: matchingPreference,
        });

        console.log("Database match response:", response);

        const transformedCandidates: Candidate[] =
          response.resume && Array.isArray(response.resume) && response.resume.length > 0
            ? response.resume.map((resume: any) => ({
              id: resume.id || 0,
              name: String(resume.full_name || ""),
              place: String(resume.location_full || ""),
              email: String(resume.email || ""),
              position: String(resume.title || ""),
              matchPercentage: typeof resume.score === 'number' ? Math.round(resume.score) : 0,
              experience: resume.experience || resume.total_experience_duration_months ?
                (typeof resume.total_experience_duration_months === 'number' ?
                  Math.floor(resume.total_experience_duration_months / 12) :
                  resume.experience) : undefined,
              hasAllMustSkills: resume.hasAllMustSkills,
              scoringBreakdown: resume.scoring_breakdown || null,
            }))
            : [];

        console.log("Transformed candidates:", transformedCandidates);

        if (transformedCandidates.length === 0) {
          setIsProcessing(false);
          setNoResultsMessage(
            response.message || "No resumes were found in the database matching the required skills and criteria. Try uploading more resumes or adjusting the job requirements."
          );
          setSelectedJob(null);
          return;
        }

        transformedCandidates.sort((a, b) => b.matchPercentage - a.matchPercentage);
        setCandidates(transformedCandidates);
        setIsProcessing(false);
        // Store job for modal and close action modal
        setModalJob(selectedJob);
        setSelectedJob(null); // Close action modal
        setShowModal(true); // Open results modal
      } catch (error) {
        console.error("Error matching from database:", error);
        setIsProcessing(false);
        setNoResultsMessage(
          "Failed to match from database. The service may be unavailable or no candidates match the required criteria. Please try again."
        );
        setSelectedJob(null);
      }
      return;
    }

    if (action === "extract" && selectedJob) {
      setIsProcessing(true); // Use separate state for processing

      try {
        const jobId = selectedJob.job_id || selectedJob.id;

        console.log("Using job ID:", jobId, "for job:", selectedJob.title);

        let response: MatchResumesResponse;
        if (selectedSource === "apollo") {
          response = await matchExtractApolloResumes({
            limit: 1,
            job_id: jobId,
            preference: matchingPreference,
          });
        } else if (selectedSource === "coresignal") {
          response = await matchExtractCoresignalResumes({
            limit: 1,
            job_id: jobId,
            preference: matchingPreference,
          });
        }

        const transformedCandidates: Candidate[] =
          response.resume && Array.isArray(response.resume) && response.resume.length > 0
            ? response.resume.map((resume: any) => ({
              id: resume.id || 0,
              name: String(resume.full_name || ""),
              place: String(resume.location_full || ""),
              email: String(resume.email || ""),
              position: String(resume.title || ""),
              matchPercentage: typeof resume.score === 'number' ? Math.round(resume.score) : 0,
              experience: resume.experience || resume.total_experience_duration_months ?
                (typeof resume.total_experience_duration_months === 'number' ?
                  Math.floor(resume.total_experience_duration_months / 12) :
                  resume.experience) : undefined,
              hasAllMustSkills: resume.hasAllMustSkills,
              scoringBreakdown: resume.scoring_breakdown || null,
            }))
            : [];

        if (transformedCandidates.length === 0) {
          setIsProcessing(false);
          setNoResultsMessage(
            response.message || "No resumes were found matching the required skills and criteria. Try adjusting the job requirements or using a different data source."
          );
          setSelectedJob(null);
          return;
        }

        // Sort candidates by match percentage (descending) - backend already sorts, but ensure it
        transformedCandidates.sort((a, b) => b.matchPercentage - a.matchPercentage);
        setCandidates(transformedCandidates);
        setIsProcessing(false);
        // Store job for modal and close action modal
        setModalJob(selectedJob);
        setSelectedJob(null); // Close action modal
        setShowModal(true); // Open results modal
      } catch (error) {
        console.error("Error fetching matched resumes:", error);
        setIsProcessing(false);
        setNoResultsMessage(
          "Failed to fetch resumes. The data source may be unavailable or no candidates match the required criteria. Please try again."
        );
        setSelectedJob(null);
      }
    } else {
      setIsProcessing(true); // Use separate state
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setIsProcessing(false); // Use separate state
      // Store job for modal and close action modal
      setModalJob(selectedJob);
      setSelectedJob(null);
      setShowModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedJob(null);
    setModalJob(null);
    setSelectedAction(null);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Sort jobs by scheduler_id (descending) to show most recent scheduler jobs first
  const displayedJobs = [...jobs].sort((a, b) => {
    const aId = parseInt(a.scheduler_id || "0", 10);
    const bId = parseInt(b.scheduler_id || "0", 10);
    return bId - aId; // Descending order
  });

  const handleView = (job: JobPostingTypes) => {
    setViewJob(job);
    setShowViewModal(true);
  };
  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewJob(null);
  };

  return (
    <div className="w-full overflow-x-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Job Descriptions
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Page {currentPage} of {Math.ceil(totalCount / itemsPerPage) || 1} (Total: {totalCount} {totalCount === 1 ? "job" : "jobs"})
              </p>
            </div>
          </div>
        </div>

        {/* Table Container - Scrollable within container, doesn't affect page */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Scheduler ID
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Job Title
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Company
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Location
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Company Link
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Job URL
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Date Posted
                </th>
              </tr>
            </thead>

            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoadingJobs && jobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                      <p className="text-gray-600 dark:text-gray-400">
                        Loading jobs...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : displayedJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      No jobs found
                    </p>
                  </td>
                </tr>
              ) : (
                displayedJobs.map((job, index) => (
                  <tr
                    key={job.id}
                    className="hover:bg-blue-50/50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {job.scheduler_id || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex justify-center gap-2 text-center">
                      {isAdmin ? (
                        <button
                          onClick={() => handleSourceClick(job)}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                        >
                          Source
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSourceClick(job)}
                          disabled
                          className="px-4 py-2 bg-gray-400 dark:bg-gray-600 text-white text-sm font-medium rounded-lg cursor-not-allowed opacity-50"
                          title="Viewers do not have access to match resumes"
                        >
                          Source
                        </button>
                      )}
                      <button
                        onClick={() => handleView(job)}
                        className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      {isAdmin ? (
                      <button
                      onClick={() => handleDeleteJob(job)}
                      className="px-3 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                      title="Delete Job"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-3 py-2 bg-gray-400 dark:bg-gray-600 text-white text-sm font-medium rounded-lg cursor-not-allowed opacity-50 inline-flex items-center gap-1"
                      title="Viewers do not have access to delete jobs"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                   )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 max-w-xs">
                      {job.job_url ? (
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors"
                        >
                          {job.title}
                        </a>
                      ) : (
                        <span>{job.title}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                      <div className="font-medium">{job.company_name}</div>
                      {job.company_industry && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {job.company_industry}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>{job.location || "-"}</span>
                        {job.country && job.country !== job.location && (
                          <span className="text-gray-400">• {job.country}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      {job.company_website ? (
                        <a
                          href={job.company_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                          Visit
                        </a>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      {job.job_url ? (
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                          View Job
                        </a>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatDate(job.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalCount > itemsPerPage && (
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-t border-gray-200 dark:border-gray-600">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                Page {currentPage} of {Math.ceil(totalCount / itemsPerPage) || 1}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, Math.ceil(totalCount / itemsPerPage)) }, (_, i) => {
                  const startPage = Math.max(1, currentPage - 2);
                  const page = startPage + i;
                  if (page > Math.ceil(totalCount / itemsPerPage)) return null;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-sm ${
                        currentPage === page
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                          : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / itemsPerPage), prev + 1))}
                  disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {showViewModal && viewJob && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Job Details</h2>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Job Title */}
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {viewJob.title}
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    {viewJob.company_name}
                  </p>
                </div>

                {/* Job Details Table */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
                  <table className="min-w-full">
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      <tr>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-1/3">
                          Location
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {viewJob.location}, {viewJob.country}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Seniority
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {viewJob.seniority}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Industry
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {viewJob.company_industry || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Company Website
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {viewJob.company_website ? (
                            <a
                              href={viewJob.company_website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {viewJob.company_website}
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Job URL
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {viewJob.job_url ? (
                            <a
                              href={viewJob.job_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              View Job Posting
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Date Posted
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {formatDate(viewJob.created_at)}
                        </td>
                      </tr>
                      {viewJob.email && (
                        <tr>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Contact Email
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <a
                              href={`mailto:${viewJob.email}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {viewJob.email}
                            </a>
                          </td>
                        </tr>
                      )}
                      {viewJob.skills &&
                        viewJob.skills.length > 0 && (
                          <tr>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Skills
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex flex-wrap gap-2">
                                {viewJob.skills.map(
                                  (skill, index) => (
                                    <span
                                      key={index}
                                      className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded-full"
                                    >
                                      {skill}
                                    </span>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>

                {/* Job Description */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Job Description
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <div className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>
                        {viewJob.description || "No description available."}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleCloseViewModal}
                className="flex-1 px-4 py-2 w-full rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Action Modal */}
      {selectedJob && !showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {selectedJob.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Select how you want to process this job:
            </p>

            <div className="space-y-3">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Select Data Source
                </label>
                <Select
                  options={[
                    { value: "apollo", label: "Apollo" },
                    { value: "coresignal", label: "Coresignals" },
                  ]}
                  defaultValue={selectedSource}
                  onChange={(value) =>
                    setSelectedSource(value as "apollo" | "coresignal")
                  }
                  placeholder="Choose a data source"
                />
              </div>
{/* 
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Matching Preference
                </label>
                <Select
                  options={[
                    {
                      value: "skills",
                      label: "Skills Priority (Must skills required, job title complimentary)"
                    },
                    {
                      value: "job_title",
                      label: "Job Title Priority (Job title required, skills complimentary)"
                    },
                  ]}
                  defaultValue={matchingPreference}
                  onChange={(value) =>
                    setMatchingPreference(value as "job_title" | "skills")
                  }
                  placeholder="Choose matching preference"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {matchingPreference === "skills"
                    ? "✓ Must skills must match. Job title and optional skills are bonus."
                    : "✓ Job title must match. All skills are bonus."}
                </p>
              </div> */}

              <button
                onClick={() => handleActionSelect("extract")}
                className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
              >
                Extract Data
              </button>

              <button
                onClick={() => handleActionSelect("database")}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
              >
                Run on Database
              </button>
              {/* linkedin,recruitly, apollo ,Coresignals */}

              {/* <button className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95">
                Export Data with Coresignals
              </button>
              <button className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95">
                Export Data with Theirstack
              </button>
              <button className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95">
                Export Data with Mantiks
              </button> */}
            </div>

            <button
              onClick={() => setSelectedJob(null)}
              className="w-full mt-4 px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg transition-all duration-200 active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                Processing{" "}
                {selectedAction === "local" ? "Locally" : "Data Extraction"}...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Matching Candidates Modal */}
      {showModal && modalJob && (
        <MatchingCandidatesModal
          job={modalJob}
          candidates={candidates}
          action={selectedAction || "local"}
          onClose={handleCloseModal}
        />
      )}

      {/* No Results Modal */}
      {noResultsMessage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              No Resumes Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm leading-relaxed">
              {noResultsMessage}
            </p>
            <button
              onClick={() => setNoResultsMessage(null)}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
