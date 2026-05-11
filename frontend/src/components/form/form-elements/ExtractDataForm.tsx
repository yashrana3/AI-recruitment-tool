

import { useState } from "react";
import ComponentCard from "../../common/ComponentCard";
import Label from "../Label";
import Select from "../Select";
import Input from "../input/InputField";
import Button from "../../ui/button/Button";
import { Download, FileText, Users, CheckCircle, XCircle } from "lucide-react";
import { getJobs } from "../../../api/DashBoard.API";
import { getResumes, ResumeData } from "../../../api/DashBoard.API";
import { JobPostingTypes } from "../../../lib/type";

export default function ExtractDataForm() {
  const [type, setType] = useState("job_desc");
  const [limit, setLimit] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const typeOptions = [
    { value: "job_desc", label: "Job Descriptions" },
    { value: "resumes", label: "Resumes" },
  ];

  // Convert array of objects to CSV
  // Convert array of objects to CSV
const convertToCSV = (data: any[], headers: string[]): string => {
  // Filter out rows where all fields are empty/null/undefined
  const filteredData = data.filter((row) => {
    // Check if at least one field has a non-empty value
    return headers.some((header) => {
      const value = row[header];
      if (value === null || value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "string") return value.trim().length > 0;
      return true; // For numbers, booleans, etc.
    });
  });

  // If no valid data after filtering, return only headers
  if (filteredData.length === 0) {
    return headers.join(",");
  }

  // Create header row
  const headerRow = headers.join(",");
  
  // Create data rows
  const dataRows = filteredData.map((row) => {
    return headers.map((header) => {
      const value = row[header];
      // Handle null/undefined
      if (value === null || value === undefined) return "";
      // Handle arrays
      if (Array.isArray(value)) {
        // Filter out empty strings from array before joining
        const filteredArray = value.filter(item => item !== null && item !== undefined && String(item).trim() !== "");
        if (filteredArray.length === 0) return "";
        return `"${filteredArray.join("; ")}"`;
      }
      // Handle strings with commas, quotes, or newlines
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) return "";
        const escaped = trimmed.replace(/"/g, '""');
        return `"${escaped}"`;
      }
      return String(value);
    }).join(",");
  });
  
  return [headerRow, ...dataRows].join("\n");
};

  // Download CSV file
  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    const limitNum = parseInt(limit);
    if (!limit || isNaN(limitNum) || limitNum <= 0) {
      setDownloadStatus({
        success: false,
        message: "Please enter a valid limit greater than 0",
      });
      setTimeout(() => setDownloadStatus(null), 3000);
      return;
    }

    setIsLoading(true);
    setDownloadStatus(null);

    try {
      if (type === "job_desc") {
        // Fetch jobs
        const response = await getJobs({
          limit: limitNum,
          offset: 0,
        });

        if (!response.jobs || response.jobs.length === 0) {
          setDownloadStatus({
            success: false,
            message: "No job descriptions found to download",
          });
          setIsLoading(false);
          setTimeout(() => setDownloadStatus(null), 3000);
          return;
        }

        // Define CSV headers for jobs
        const headers = [
          "id",
          "title",
          "company_name",
          "location",
          "country",
          "seniority",
          "job_url",
          "company_website",
          "company_industry",
          "email",
          "description",
          "created_at",
          "scheduler_id",
        ];

        // Convert jobs to CSV format (handle arrays properly)
        const csvData = response.jobs.filter((job: JobPostingTypes) => {
          // Filter out jobs with no meaningful data
          return job.id || job.job_id || job.title || job.company_name || job.description;
        })
        .map((job: JobPostingTypes) => ({
          id: job.id || job.job_id || "",
          title: job.title || "",
          company_name: job.company_name || "",
          location: job.location || "",
          country: job.country || "",
          seniority: job.seniority || "",
          job_url: job.job_url || "",
          company_website: job.company_website || "",
          company_industry: job.company_industry || "",
          email: job.email || "",
          description: job.description || "",
          created_at: job.created_at || "",
          scheduler_id: job.scheduler_id || "",
        }));

        const csvContent = convertToCSV(csvData, headers);
        const filename = `job_descriptions_${new Date().toISOString().split("T")[0]}.csv`;
        downloadCSV(csvContent, filename);

        setDownloadStatus({
          success: true,
          message: `Successfully downloaded ${response.jobs.length} job description(s)`,
        });
        setTimeout(() => setDownloadStatus(null), 5000);
      } else {
        // Fetch resumes
        const response = await getResumes({
          limit: limitNum,
          offset: 0,
        });

        if (!response.resumes || response.resumes.length === 0) {
          setDownloadStatus({
            success: false,
            message: "No resumes found to download",
          });
          setIsLoading(false);
          setTimeout(() => setDownloadStatus(null), 3000);
          return;
        }

        // Define CSV headers for resumes
        const headers = [
          "full_name",
          "email",
          "title",
          "location_full",
          "location_country",
          "headline",
          "experience",
          "skills",
          "linkedin_url",
        ];

        // Convert resumes to CSV format
        const csvData = response.resumes
        .filter((resume: ResumeData) => {
          // Filter out resumes with no meaningful data
          return resume.id || resume.full_name || resume.email || resume.linkedin_url;
        })
        .map((resume: ResumeData) => ({
          full_name: resume.full_name || "",
          email: resume.email || "",
          title: resume.title || "",
          location_full: Array.isArray(resume.location_full)
            ? resume.location_full.join("; ")
            : resume.location_full || "",
          location_country: resume.location_country || "",
          headline: resume.headline || "",
          experience: resume.experience || "",
          skills: Array.isArray(resume.skills)
            ? resume.skills.filter(s => s && String(s).trim() !== "").join("; ")
            : resume.skills || "",
          linkedin_url: resume.linkedin_url || "",
        }));

        const csvContent = convertToCSV(csvData, headers);
        const filename = `resumes_${new Date().toISOString().split("T")[0]}.csv`;
        downloadCSV(csvContent, filename);

        setDownloadStatus({
          success: true,
          message: `Successfully downloaded ${response.resumes.length} resume(s)`,
        });
        setTimeout(() => setDownloadStatus(null), 5000);
      }
    } catch (error: any) {
      console.error("Error downloading data:", error);
      setDownloadStatus({
        success: false,
        message: error.response?.data?.detail || error.message || "Failed to download data",
      });
      setTimeout(() => setDownloadStatus(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = () => {
    return type === "job_desc" ? (
      <FileText className="w-5 h-5" />
    ) : (
      <Users className="w-5 h-5" />
    );
  };

  return (
    <ComponentCard title="Data Extraction">
      <div className="space-y-6">
        {/* Select Type */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">Select Type</Label>
          <Select
            options={typeOptions}
            placeholder="Select Type"
            onChange={(val: string) => setType(val)}
            className="dark:bg-dark-900 w-full"
          />
        </div>

        {/* Type Preview */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-400 dark:border-dark-600">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-dark-600 text-blue-600 dark:text-blue-400">
            {getIcon()}
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-600 dark:text-gray-300">Selected Type</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {typeOptions.find((opt) => opt.value === type)?.label}
            </p>
          </div>
        </div>

        {/* Limit */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">
            Extraction Limit
          </Label>
          <Input
            type="number"
            placeholder="Enter number of records"
            value={limit}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setLimit(e.target.value)
            }
            className="w-full"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {limit ? `Will extract ${limit} records` : "No limit set"}
          </p>
        </div>

        {/* Download Button */}
        <div>
          <Button
            className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            size="sm"
            onClick={handleSubmit}
            disabled={!limit || isLoading || parseInt(limit) <= 0}
          >
            <Download className="w-4 h-4" />
            {isLoading ? "Downloading..." : "Download CSV"}
          </Button>
        </div>

        {/* Status Message */}
        {downloadStatus && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              downloadStatus.success
                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            }`}
          >
            {downloadStatus.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            )}
            <p
              className={`text-sm ${
                downloadStatus.success
                  ? "text-green-800 dark:text-green-200"
                  : "text-red-800 dark:text-red-200"
              }`}
            >
              {downloadStatus.message}
            </p>
          </div>
        )}
      </div>
    </ComponentCard>
  );
}


