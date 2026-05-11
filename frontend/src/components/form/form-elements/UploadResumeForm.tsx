import { useState, useRef } from "react";
import ComponentCard from "../../common/ComponentCard";
import Label from "../Label";
import Button from "../../ui/button/Button";
import { Upload, CheckCircle, XCircle, FileText, AlertCircle } from "lucide-react";
import { uploadResumes, UploadResumeResponse } from "../../../api/DashBoard.API";

export default function UploadResumeForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    success: boolean;
    message: string;
    details?: UploadResumeResponse;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validExtensions = ['.xlsx', '.xls', '.csv', '.tsv'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!validExtensions.includes(fileExtension)) {
        setUploadStatus({
          success: false,
          message: `Invalid file type. Please upload ${validExtensions.join(', ')} files only.`,
        });
        setTimeout(() => setUploadStatus(null), 5000);
        return;
      }
      
      setSelectedFile(file);
      setUploadStatus(null); // Clear previous status
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus({
        success: false,
        message: "Please select a file to upload",
      });
      setTimeout(() => setUploadStatus(null), 5000);
      return;
    }

    setIsLoading(true);
    setUploadStatus(null);

    try {
      const response = await uploadResumes(selectedFile);
      
      // Build success message with details
      let message = `Upload completed successfully! `;
      message += `${response.saved} resume(s) saved`;
      
      if (response.duplicates > 0) {
        message += `, ${response.duplicates} duplicate(s) skipped`;
      }
      if (response.invalid > 0) {
        message += `, ${response.invalid} invalid row(s)`;
      }

      setUploadStatus({
        success: true,
        message,
        details: response,
      });
      
      // Clear file selection after successful upload
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Auto-hide success message after 10 seconds
      setTimeout(() => setUploadStatus(null), 10000);
    } catch (error: any) {
      console.error("Error uploading resumes:", error);
      
      let errorMessage = "Failed to upload resumes";
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.detail.message) {
          errorMessage = error.response.data.detail.message;
        } else if (error.response.data.detail.error) {
          errorMessage = error.response.data.detail.error;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      setUploadStatus({
        success: false,
        message: errorMessage,
      });
      setTimeout(() => setUploadStatus(null), 8000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setUploadStatus(null);
  };

  return (
    <ComponentCard title="Upload Resume">
      <div className="space-y-6">
        {/* File Upload Input */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">
            Select File (XLSX, CSV, or TSV)
          </Label>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.tsv"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedFile ? selectedFile.name : "Click to select file"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Supports: .xlsx, .xls, .csv, .tsv
                </p>
              </div>
            </label>
          </div>
          
          {/* Selected File Preview */}
          {selectedFile && (
            <div className="mt-3 flex items-center gap-3 p-3 rounded-lg border border-blue-400 dark:border-dark-600 bg-blue-50 dark:bg-blue-900/20">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-dark-600 text-blue-600 dark:text-blue-400">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-600 dark:text-gray-300">Selected File</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <button
                onClick={handleRemoveFile}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                type="button"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <div>
          <Button
            className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            size="sm"
            onClick={handleUpload}
            disabled={!selectedFile || isLoading}
          >
            <Upload className="w-4 h-4" />
            {isLoading ? "Uploading..." : "Upload Resumes"}
          </Button>
        </div>

        {/* Status Message */}
        {uploadStatus && (
          <div
            className={`flex items-start gap-3 p-4 rounded-lg ${
              uploadStatus.success
                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            }`}
          >
            {uploadStatus.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  uploadStatus.success
                    ? "text-green-800 dark:text-green-200"
                    : "text-red-800 dark:text-red-200"
                }`}
              >
                {uploadStatus.message}
              </p>
              
              {/* Show detailed results if available */}
              {uploadStatus.success && uploadStatus.details && (
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span>• Total rows processed: {uploadStatus.details.total_rows}</span>
                  </div>
                  {uploadStatus.details.sheets_processed && uploadStatus.details.sheets_processed.length > 0 && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <span>• Sheets processed: {uploadStatus.details.sheets_processed.map(s => s.sheet_name).join(', ')}</span>
                    </div>
                  )}
                  {uploadStatus.details.duplicates > 0 && (
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                      <AlertCircle className="w-4 h-4" />
                      <span>{uploadStatus.details.duplicates} duplicate(s) were skipped</span>
                    </div>
                  )}
                  {uploadStatus.details.invalid > 0 && (
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                      <AlertCircle className="w-4 h-4" />
                      <span>{uploadStatus.details.invalid} invalid row(s) found</span>
                    </div>
                  )}
                  {uploadStatus.details.invalid_rows && uploadStatus.details.invalid_rows.length > 0 && (
                    <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                      <p className="font-semibold mb-1">Invalid rows:</p>
                      {uploadStatus.details.invalid_rows.slice(0, 5).map((invalid, idx) => (
                        <p key={idx} className="text-gray-600 dark:text-gray-400">
                          Row {invalid.row}: {invalid.error}
                        </p>
                      ))}
                      {uploadStatus.details.invalid_rows.length > 5 && (
                        <p className="text-gray-500 dark:text-gray-500 mt-1">
                          ... and {uploadStatus.details.invalid_rows.length - 5} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ComponentCard>
  );
}