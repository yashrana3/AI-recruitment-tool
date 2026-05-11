import { useState, useEffect } from "react";
import { Eye, Trash2, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import PageBreadcrumb from "../common/PageBreadCrumb";
import { getResumes, ResumeData, deleteResume } from "../../api/DashBoard.API";
import { useUserRole } from "../../hooks/useUserRole";

export default function Resumes() {
  const { isAdmin, isViewer } = useUserRole();
  const [tableData, setTableData] = useState<ResumeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedResume, setSelectedResume] = useState<ResumeData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchResumes = async () => {
      setLoading(true);
      try {
        const offset = (currentPage - 1) * itemsPerPage;
        const response = await getResumes({
          offset: offset,
          limit: itemsPerPage,
          q: searchQuery || undefined,
        });
        setTableData(response.resumes);
        setTotalCount(response.count);
      } catch (error) {
        console.error("Error fetching resumes:", error);
        setTableData([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchResumes();
  }, [currentPage, itemsPerPage, searchQuery]);

  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;

  const handleView = (resume: ResumeData) => {
    setSelectedResume(resume);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (isViewer) {
      alert("Viewers do not have access to delete resumes. Please contact an administrator.");
      return;
    }
    
    const resume = tableData.find((r) => r.id === id);
    const resumeName = resume?.full_name || resume?.email || "this resume";
    
    if (!confirm(`Are you sure you want to delete ${resumeName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteResume(id);
      
      // Remove from local state after successful deletion
      setTableData((prev) => prev.filter((r) => r.id !== id));
      
      // Close modal if it's open for this resume
      if (selectedResume?.id === id) {
        setShowModal(false);
        setSelectedResume(null);
      }
      
      // Refresh the list to update the count
      const offset = (currentPage - 1) * itemsPerPage;
      const response = await getResumes({
        offset: offset,
        limit: itemsPerPage,
        q: searchQuery || undefined,
      });
      setTableData(response.resumes);
      setTotalCount(response.count);
      
      // Show success message (optional)
      alert("Resume deleted successfully");
    } catch (err: any) {
      console.error("Error deleting resume:", err);
      const errorMessage = err.response?.data?.detail?.message || err.message || "Failed to delete resume. Please try again.";
      alert(errorMessage);
    }
  };
  
  const handleDownload = (resume: ResumeData) => {
    // Implement actual download logic here
    console.log(`Downloading resume for ${resume.full_name}`);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page on search
  };

  const clearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  const formatLocation = (locationFull: string[]) => {
    return Array.isArray(locationFull) ? locationFull.join(", ") : locationFull || "-";
  };

  const formatSummary = (summary: string | string[]) => {
    if (typeof summary === "string") return summary;
    if (Array.isArray(summary)) return summary.join(" ");
    return "N/A";
  };

  const formatSkills = (skills: string[]) => {
    if (!Array.isArray(skills)) return "N/A";
    return skills.slice(0, 5).join(", ") + (skills.length > 5 ? ` +${skills.length - 5} more` : "");
  };

  return (
    <div className="w-full overflow-x-hidden">
      <div className="mb-6">
        <PageBreadcrumb pageTitle="Resume Management" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Resume Management
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {totalCount} {totalCount === 1 ? "resume" : "resumes"} found
              </p>
            </div>
          </div>
          
          {/* Search Input */}
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search resumes by skills, name, or keywords..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              </button>
            )}
          </div>
        </div>

        {/* Table Container - Scrollable within container, doesn't affect page */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Full Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Title
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Location
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Experience
                </th>
                {/* <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Skills
                </th> */}
              </tr>
            </thead>

            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading && tableData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                      <p className="text-gray-600 dark:text-gray-400">Loading resumes...</p>
                    </div>
                  </td>
                </tr>
              ) : tableData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchQuery ? "No resumes found matching your search" : "No resumes found"}
                    </p>
                  </td>
                </tr>
              ) : (
                tableData.map((resume, index) => (
                  <tr
                    key={resume.id}
                    className="hover:bg-blue-50/50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleView(resume)}
                          className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        {isAdmin ? (
                          <button
                            onClick={() => handleDelete(resume.id)}
                            className="px-3 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDelete(resume.id)}
                            disabled
                            className="px-3 py-2 bg-gray-400 dark:bg-gray-600 text-white text-sm font-medium rounded-lg cursor-not-allowed opacity-50 inline-flex items-center gap-1"
                            title="Viewers do not have access to delete resumes"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {resume.full_name}
                        </span>
                        {resume.linkedin_url && (
                          <a
                            href={resume.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.065 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                            </svg>
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                      {resume.title}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatLocation(resume.location_full)}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      <a
                        href={`mailto:${resume.email}`}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors"
                      >
                        {resume.email}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                        {resume.experience} years
                      </span>
                    </td>
                    {/* <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                      <span title={Array.isArray(resume.skills) ? resume.skills.join(", ") : ""}>
                        {formatSkills(resume.skills)}
                      </span>
                    </td> */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* <button
                          onClick={() => handleView(resume)}
                          className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button> */}
                        {/* <button
                          onClick={() => handleDownload(resume)}
                          className="px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                        <button
                          onClick={() => handleDelete(resume.id)}
                          className="px-3 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button> */}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with Pagination */}
        <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Showing{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {tableData.length > 0 ? startIndex + 1 : 0}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {startIndex + tableData.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {totalCount}
                </span>
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || loading}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-9 h-9 rounded-lg font-medium text-sm transition-colors ${
                        currentPage === page
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                          : "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || loading}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* View Resume Modal */}
      {showModal && selectedResume && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 rounded-t-2xl sticky top-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Resume Details</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Full Name:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{selectedResume.full_name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Headline:</span>
                <span className="font-semibold text-gray-900 dark:text-white text-right">{selectedResume.headline}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Title:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{selectedResume.title}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Email:</span>
                <a
                  href={`mailto:${selectedResume.email}`}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {selectedResume.email}
                </a>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Location:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatLocation(selectedResume.location_full)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Country:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{selectedResume.location_country}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Experience:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{selectedResume.experience} years</span>
              </div>
              <div className="py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400 block mb-2">Summary:</span>
                <p className="text-sm text-gray-900 dark:text-white">{formatSummary(selectedResume.summary)}</p>
              </div>
              <div className="py-2">
                <span className="text-gray-600 dark:text-gray-400 block mb-2">Skills:</span>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(selectedResume.skills) && selectedResume.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              {selectedResume.linkedin_url && (
                <div className="py-2">
                  <a
                    href={selectedResume.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    View LinkedIn Profile
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 rounded-b-2xl flex gap-3 sticky bottom-0">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors active:scale-95"
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
