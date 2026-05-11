// ... existing imports and interfaces ...

import { useEffect, useState } from "react";
import { getMatched } from "../../api/DashBoard.API";
import PageBreadcrumb from "../common/PageBreadCrumb";
import MatchingCandidatesModal from "./MatchingCandidatesModal";
import { Eye, ExternalLink, Mail, MapPin, Briefcase, User } from "lucide-react";

interface JobDetails {
  title?: string;
  company_name?: string;
  location?: string;
  country?: string;
  seniority?: string;
  job_url?: string;
  description?: string;
}

interface ResumeDetails {
  full_name?: string;
  email?: string;
  title?: string;
  location_full?: string;
  headline?: string;
  skills?: string[];
  experience?: number;
  linkedin_url?: string;
}

interface ApiMatchItem {
  job_id: string;
  resume_id: string;
  score: string;
  job?: JobDetails;
  resume?: ResumeDetails;
}

export default function JobMatchingCandidates() {
  const [jobMatches, setJobMatches] = useState<ApiMatchItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedJobMatch, setSelectedJobMatch] = useState<ApiMatchItem | null>(
    null
  );
  const [selectedJob, setSelectedJob] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMatchDetails, setSelectedMatchDetails] = useState<ApiMatchItem | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const matchesPerPage = 10;

  useEffect(() => {
    const fetchJobMatches = async () => {
      try {
        setIsLoading(true);
        const offset = (currentPage - 1) * matchesPerPage;
        const response = await getMatched({
          offset: offset,
          limit: matchesPerPage,
        });

        // Handle API response: { count, matched: [{ job_id, resume_id, score }] }
        if (response.matched && Array.isArray(response.matched)) {
          // Display individual matches directly, no grouping
          setJobMatches(response.matched);
          setTotalCount(response.count || response.matched.length);
        } else {
          setJobMatches([]);
          setTotalCount(0);
        }
      } catch (err) {
        console.error("Error fetching job matches:", err);
        setJobMatches([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobMatches();
  }, [currentPage]);

  const totalPages = Math.ceil(totalCount / matchesPerPage) || 1;
  const currentMatches = jobMatches;

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const maxVisiblePages = 4;
  const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  const visiblePages = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );

  const handleViewCandidatesClick = async (match: ApiMatchItem) => {
    setSelectedJobMatch(match);
    // Create a job object from the match data
    const matchedJob = {
      id: parseInt(match.job_id.replace(/[^0-9]/g, "")) || 0,
      title: `Job ${match.job_id}`,
      company: "N/A",
      location: "N/A",
    };
    setSelectedJob(matchedJob);
    setIsLoading(true);

    // Simulate 1 second processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsLoading(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedJobMatch(null);
    setSelectedJob(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900 p-4 lg:p-4">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-2">
          <div className="mb-2">
            <PageBreadcrumb pageTitle="Job Matching Candidates" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200 dark:border-gray-600">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                Page {currentPage} of {totalPages} (Total Matches: {totalCount})
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm"
                >
                  Previous
                </button>

                {visiblePages.map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-sm ${
                      currentPage === page
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                        : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-100 to-blue-100 dark:from-gray-700 dark:to-gray-600">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                    Job
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                    Candidate
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {currentMatches.length > 0 ? (
                  currentMatches.map((match, index) => (
                    <tr
                      key={`${match.job_id}-${match.resume_id}-${index}`}
                      className={`hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors duration-150 ${
                        index % 2 === 0
                          ? "bg-white dark:bg-gray-800"
                          : "dark:bg-gray-750"
                      }`}
                    >
                      <td className="px-6 py-4">
                        {match.job ? (
                          <div className="space-y-1">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {match.job.title || "N/A"}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {match.job.company_name || "N/A"}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {match.job.location || "N/A"}
                              {match.job.country && `, ${match.job.country}`}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Job ID: {match.job_id}
                            </span>
                            <div className="text-xs text-gray-400 dark:text-gray-600 italic">
                              Job details not available
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {match.resume ? (
                          <div className="space-y-1">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {match.resume.full_name || "N/A"}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                              <Briefcase className="w-3 h-3" />
                              {match.resume.title || "N/A"}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {match.resume.location_full || "N/A"}
                            </div>
                            {match.resume.email && (
                              <div className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {match.resume.email}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Resume ID: {match.resume_id}
                            </span>
                            <div className="text-xs text-gray-400 dark:text-gray-600 italic">
                              Resume details not available
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        <span className="inline-flex items-center justify-center px-3 py-1 text-sm font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900 rounded-full">
                          {parseFloat(match.score).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedMatchDetails(match);
                            setShowDetailsModal(true);
                          }}
                          className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      {isLoading ? "Loading..." : "No matched records found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Loading Modal */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-99999">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                Loading Matched Candidates...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Matching Candidates Modal */}
      {showModal && selectedJob && selectedJobMatch && (
        <MatchingCandidatesModal
          job={selectedJob}
          candidates={[]}
          action="local"
          onClose={handleCloseModal}
          matched={true}
        />
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedMatchDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  Match Details
                </h3>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedMatchDetails(null);
                  }}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-2">
                <span className="inline-flex items-center px-3 py-1 text-sm font-semibold text-white bg-white/20 rounded-full">
                  Match Score: {parseFloat(selectedMatchDetails.score).toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Job Details */}
              {selectedMatchDetails.job ? (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Job Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Title:</span>
                      <p className="text-gray-900 dark:text-white">{selectedMatchDetails.job.title || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Company:</span>
                      <p className="text-gray-900 dark:text-white">{selectedMatchDetails.job.company_name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Location:</span>
                      <p className="text-gray-900 dark:text-white">
                        {selectedMatchDetails.job.location || "N/A"}
                        {selectedMatchDetails.job.country && `, ${selectedMatchDetails.job.country}`}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Seniority:</span>
                      <p className="text-gray-900 dark:text-white">{selectedMatchDetails.job.seniority || "N/A"}</p>
                    </div>
                     {selectedMatchDetails.job.job_url && (
                       <div className="md:col-span-2">
                         <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Job URL:</span>
                         <a
                           href={selectedMatchDetails.job.job_url}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 break-all"
                         >
                           <span className="break-all">{selectedMatchDetails.job.job_url}</span>
                           <ExternalLink className="w-4 h-4 flex-shrink-0" />
                         </a>
                       </div>
                     )}
                     {selectedMatchDetails.job.description && (
                       <div className="md:col-span-2">
                         <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Description:</span>
                         <p className="text-gray-900 dark:text-white mt-1 break-words overflow-wrap-anywhere whitespace-pre-wrap">{selectedMatchDetails.job.description}</p>
                       </div>
                     )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Job Details
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    Job details not available (Job ID: {selectedMatchDetails.job_id})
                  </p>
                </div>
              )}

              {/* Resume Details */}
              {selectedMatchDetails.resume ? (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Candidate Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Name:</span>
                      <p className="text-gray-900 dark:text-white">{selectedMatchDetails.resume.full_name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Email:</span>
                      <p className="text-gray-900 dark:text-white flex items-center gap-1">
                        {selectedMatchDetails.resume.email || "N/A"}
                        {selectedMatchDetails.resume.email && (
                          <a
                            href={`mailto:${selectedMatchDetails.resume.email}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <Mail className="w-4 h-4" />
                          </a>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Title:</span>
                      <p className="text-gray-900 dark:text-white">{selectedMatchDetails.resume.title || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Experience:</span>
                      <p className="text-gray-900 dark:text-white">
                        {selectedMatchDetails.resume.experience ? `${selectedMatchDetails.resume.experience} years` : "N/A"}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Location:</span>
                      <p className="text-gray-900 dark:text-white">{selectedMatchDetails.resume.location_full || "N/A"}</p>
                    </div>
                     {selectedMatchDetails.resume.headline && (
                       <div className="md:col-span-2">
                         <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Headline:</span>
                         <p className="text-gray-900 dark:text-white mt-1 break-words overflow-wrap-anywhere whitespace-pre-wrap">{selectedMatchDetails.resume.headline}</p>
                       </div>
                     )}
                     {selectedMatchDetails.resume.skills && selectedMatchDetails.resume.skills.length > 0 && (
                       <div className="md:col-span-2">
                         <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Skills:</span>
                         <div className="flex flex-wrap gap-2 mt-1">
                           {selectedMatchDetails.resume.skills.map((skill, idx) => (
                             <span
                               key={idx}
                               className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                             >
                               {skill}
                             </span>
                           ))}
                         </div>
                       </div>
                     )}
                     {selectedMatchDetails.resume.linkedin_url && (
                       <div className="md:col-span-2">
                         <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">LinkedIn:</span>
                         <a
                           href={selectedMatchDetails.resume.linkedin_url}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 break-all"
                         >
                           <span className="break-all">{selectedMatchDetails.resume.linkedin_url}</span>
                           <ExternalLink className="w-4 h-4 flex-shrink-0" />
                         </a>
                       </div>
                     )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Candidate Details
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    Resume details not available (Resume ID: {selectedMatchDetails.resume_id})
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedMatchDetails(null);
                }}
                className="w-full px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
