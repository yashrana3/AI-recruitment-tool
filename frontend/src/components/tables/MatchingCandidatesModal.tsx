import { X, Mail, Phone, MapPin, Check, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import React from "react";
import { matchCandidate } from "../../api/DashBoard.API";
import { JobPostingTypes } from "../../lib/type";

interface Candidate {
  id: number;
  name: string;
  place: string;
  email: string;
  number?: string;
  position: string;
  matchPercentage: number;
  isMatched?: boolean;
  experience?: number;
  hasAllMustSkills?: boolean;
  scoringBreakdown?: {
    job_title_score?: number;
    skills_score?: number;
    must_skills_matched?: number;
    must_skills_total?: number;
    must_skills_matched_list?: string[];
    must_skills_unmatched_list?: string[];
    optional_skills_matched?: number;
    optional_skills_total?: number;
    optional_skills_matched_list?: string[];
    optional_skills_unmatched_list?: string[];
    all_skills_matched?: number;
    all_skills_total?: number;
    location_score?: number;
    experience_score?: number;
    total_score: number;
    preference: "job_title" | "skills";
    percentile?: number;
    //rank?: number;
    total_candidates?: number;
    candidates_better?: number;
    candidates_worse?: number;
  } | null;
}

interface MatchingCandidatesModalProps {
  job?: JobPostingTypes;
  candidates?: Candidate[];
  action?: "local" | "extract" | "database";
  onClose?: () => void;
  matched?: boolean;
}

const MatchingCandidatesModal: React.FC<MatchingCandidatesModalProps> = ({
  job,
  candidates: initialCandidates,
  action = "local",
  onClose = () => { },
  matched = false,
}) => {
  const dummyJob: JobPostingTypes = {
    id: "1",
    title: "Senior Full Stack Developer",
    company_name: "Tech Innovations Inc",
    location: "San Francisco, CA",
    country: "USA",
    description: "",
    seniority: "Senior",
    job_url: "",
    company_website: "",
    company_industry: "",
    company_keywords: [],
    email: null,
    created_at: new Date().toISOString(),
  };

  const finalJob = job || dummyJob;
  const [candidatesList, setCandidatesList] = useState<Candidate[]>(
    initialCandidates || []
  );
  const [expandedCandidates, setExpandedCandidates] = useState<Set<number>>(new Set());

  const sortedCandidates = [...candidatesList].sort(
    (a, b) => b.matchPercentage - a.matchPercentage
  );

  const getMatchColor = (percentage: number) => {
    if (percentage >= 90)
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (percentage >= 75)
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (percentage >= 60)
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  };

  const toggleMatchStatus = async (candidateId: number | string) => {
    // Find the candidate to get their score
    const candidate = candidatesList.find((c) => c.id === candidateId);
    if (!candidate || !finalJob || candidate.isMatched) return;

    try {
      // Call the API
      await matchCandidate({
        job_id: finalJob.id.toString(),
        resume_id: String(candidateId), // Convert to string
        score: candidate.matchPercentage,
      });

      // Update local state to mark as matched
      setCandidatesList((prev) =>
        prev.map((c) =>
          c.id === candidateId ? { ...c, isMatched: true } : c
        )
      );
    } catch (error) {
      console.error("Error toggling match status:", error);
    }
  };

  const matchedCount = candidatesList.filter((c) => c.isMatched).length;

  const toggleExpanded = (candidateId: number) => {
    setExpandedCandidates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(candidateId)) {
        newSet.delete(candidateId);
      } else {
        newSet.add(candidateId);
      }
      return newSet;
    });
  };

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return "text-green-600 dark:text-green-400";
    if (percentage >= 60) return "text-blue-600 dark:text-blue-400";
    if (percentage >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-gray-600 dark:text-gray-400";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-99999 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{finalJob.title}</h2>
            <p className="text-blue-100 text-sm">
              {finalJob.company_name} • {finalJob.location}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Matching Candidates Section */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-blue-600 rounded"></span>
              Matching Candidates
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Processed via{" "}
              {action === "local"
                ? "Local Processing"
                : action === "database"
                  ? "Database Processing"
                  : "Data Extraction"} •{" "}
              {sortedCandidates.length} {sortedCandidates.length === 1 ? 'candidate' : 'candidates'} found (Top 10) • {matchedCount}{" "}
              {matchedCount === 1 ? 'matched' : 'matched'}
            </p>
          </div>

          {/* Candidates Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Experience
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Must Skills
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Match %
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedCandidates.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                          <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          No Resumes Found
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                          No resumes were found matching the required skills and criteria for this position. Try adjusting the job requirements or using a different data source.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {sortedCandidates.map((candidate, index) => {
                  const isExpanded = expandedCandidates.has(candidate.id);
                  const breakdown = candidate.scoringBreakdown;
                  return (
                    <React.Fragment key={candidate.id}>
                      <tr
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 ${index % 2 === 0
                            ? "bg-white dark:bg-gray-800"
                            : "dark:bg-gray-750"
                          }`}
                      >
                        <td className="px-4 py-4 text-center">
                          {breakdown && (
                            <button
                              onClick={() => toggleExpanded(candidate.id)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm font-medium"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-4 h-4" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4" />
                                  Show
                                </>
                              )}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {candidate.name}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {candidate.position}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            {candidate.place}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {candidate.experience !== undefined
                              ? `${candidate.experience} ${candidate.experience === 1 ? 'year' : 'years'}`
                              : 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {candidate.hasAllMustSkills !== undefined && (
                            <span
                              className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-semibold ${candidate.hasAllMustSkills
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                }`}
                              title={candidate.hasAllMustSkills ? "All must skills matched" : "Partial must skills match"}
                            >
                              {candidate.hasAllMustSkills ? "✓ All" : "Partial"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <a
                            href={`mailto:${candidate.email}`}
                            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                          >
                            <Mail className="w-4 h-4" />
                            {candidate.email}
                          </a>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold ${getMatchColor(
                                candidate.matchPercentage
                              )}`}
                            >
                              {candidate.matchPercentage}%
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => toggleMatchStatus(candidate.id)}
                            disabled={candidate.isMatched}
                            className={`inline-flex items-center justify-center px-3 py-2 rounded-lg transition-all duration-200 font-medium text-sm gap-1 ${candidate.isMatched
                                ? "bg-green-600 text-white cursor-not-allowed"
                                : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white"
                              }`}
                          >
                            {candidate.isMatched ? (
                              <>
                                <Check className="w-4 h-4" />
                                Matched
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                Match
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && breakdown && (
                        <tr>
                          <td colSpan={9} className="px-4 py-4 bg-gray-50 dark:bg-gray-900">
                            <div className="space-y-4 min-w-full">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                  Scoring Breakdown (Percentile-based)
                                </h4>
                                {breakdown.percentile !== undefined && breakdown.total_candidates && (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                      Percentile: {breakdown.percentile.toFixed(1)}%
                                    </span>
                                    {/* <span className="text-xs text-gray-600 dark:text-gray-400">
                                      Rank {breakdown.rank || 'N/A'}/{breakdown.total_candidates} • Better than {breakdown.candidates_worse || 0} candidates
                                    </span> */}
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Skills Score (70%) */}
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                      Skills (70%)
                                    </span>
                                    <span className={`text-sm font-bold ${getScoreColor(breakdown.skills_score || 0, 70)}`}>
                                      {breakdown.skills_score?.toFixed(1) || 0}/70
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${(breakdown.skills_score || 0) >= 56 ? "bg-green-500" :
                                          (breakdown.skills_score || 0) >= 35 ? "bg-yellow-500" : "bg-red-500"
                                        }`}
                                      style={{
                                        width: `${((breakdown.skills_score || 0) / 70) * 100}%`
                                      }}
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {breakdown.must_skills_matched || 0}/{breakdown.must_skills_total || 0} must skills matched
                                  </p>
                                  {breakdown.optional_skills_total && breakdown.optional_skills_total > 0 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {breakdown.optional_skills_matched || 0}/{breakdown.optional_skills_total} optional matched
                                    </p>
                                  )}
                                </div>

                                {/* Location Score (20%) */}
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Location (20%)</span>
                                    <span className={`text-sm font-bold ${getScoreColor(breakdown.location_score || 0, 20)}`}>
                                      {breakdown.location_score?.toFixed(1) || 0}/20
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${(breakdown.location_score || 0) >= 15 ? "bg-green-500" :
                                          (breakdown.location_score || 0) >= 10 ? "bg-yellow-500" : "bg-red-500"
                                        }`}
                                      style={{ width: `${((breakdown.location_score || 0) / 20) * 100}%` }}
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {(breakdown.location_score || 0) >= 20 ? "Same City" :
                                      (breakdown.location_score || 0) >= 15 ? "Remote Allowed" :
                                        (breakdown.location_score || 0) >= 10 ? "Same Country" : "No Match"}
                                  </p>
                                </div>

                                {/* Experience Score (10%) */}
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Experience (10%)</span>
                                    <span className={`text-sm font-bold ${getScoreColor(breakdown.experience_score || 0, 10)}`}>
                                      {breakdown.experience_score?.toFixed(1) || 0}/10
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${(breakdown.experience_score || 0) >= 7 ? "bg-green-500" :
                                          (breakdown.experience_score || 0) >= 5 ? "bg-yellow-500" : "bg-red-500"
                                        }`}
                                      style={{ width: `${((breakdown.experience_score || 0) / 10) * 100}%` }}
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {(breakdown.experience_score || 0) >= 10 ? "Meets Requirement" :
                                      (breakdown.experience_score || 0) >= 7 ? "≥80% Requirement" :
                                        (breakdown.experience_score || 0) >= 5 ? "≥50% Requirement" : "Below 50%"}
                                  </p>
                                </div>
                              </div>

                              {/* Total Score */}
                              <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-700">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Total Match Score</span>
                                  <span className={`text-2xl font-bold ${getScoreColor(breakdown.total_score, 100)}`}>
                                    {breakdown.total_score.toFixed(1)}/100
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mt-2">
                                  <div
                                    className={`h-3 rounded-full transition-all ${breakdown.total_score >= 80 ? "bg-green-500" :
                                        breakdown.total_score >= 60 ? "bg-blue-500" :
                                          breakdown.total_score >= 40 ? "bg-yellow-500" : "bg-red-500"
                                      }`}
                                    style={{ width: `${breakdown.total_score}%` }}
                                  />
                                </div>
                              </div>

                              {/* Detailed Skills Breakdown */}
                              <div className="mt-4 space-y-4">
                                {/* Must Skills Details */}
                                {breakdown.must_skills_total > 0 && (
                                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                      Must Skills ({breakdown.must_skills_matched}/{breakdown.must_skills_total} matched)
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {/* Matched Skills */}
                                      {breakdown.must_skills_matched_list && breakdown.must_skills_matched_list.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">
                                            ✓ Matched ({breakdown.must_skills_matched_list.length}):
                                          </p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {breakdown.must_skills_matched_list.map((skill: string, idx: number) => (
                                              <span
                                                key={idx}
                                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                              >
                                                {skill}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {/* Unmatched Skills */}
                                      {breakdown.must_skills_unmatched_list && breakdown.must_skills_unmatched_list.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-2">
                                            ✗ Not Matched ({breakdown.must_skills_unmatched_list.length}):
                                          </p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {breakdown.must_skills_unmatched_list.map((skill: string, idx: number) => (
                                              <span
                                                key={idx}
                                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                              >
                                                {skill}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Optional Skills Details */}
                                {breakdown.optional_skills_total > 0 && (
                                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                      Optional Skills ({breakdown.optional_skills_matched}/{breakdown.optional_skills_total} matched)
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {/* Matched Skills */}
                                      {breakdown.optional_skills_matched_list && breakdown.optional_skills_matched_list.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-2">
                                            ✓ Matched ({breakdown.optional_skills_matched_list.length}):
                                          </p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {breakdown.optional_skills_matched_list.map((skill: string, idx: number) => (
                                              <span
                                                key={idx}
                                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                              >
                                                {skill}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {/* Unmatched Skills */}
                                      {breakdown.optional_skills_unmatched_list && breakdown.optional_skills_unmatched_list.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                                            ○ Not Matched ({breakdown.optional_skills_unmatched_list.length}):
                                          </p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {breakdown.optional_skills_unmatched_list.map((skill: string, idx: number) => (
                                              <span
                                                key={idx}
                                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                              >
                                                {skill}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-500 dark:bg-gray-750 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg transition-all duration-200"
          >
            Close
          </button>
          {/* <button className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg">
            Export Results
          </button> */}
        </div>
      </div>
    </div>
  );
};

export default MatchingCandidatesModal;
