import React, { useState, useEffect } from "react";
import Button from "../ui/button/Button";
import ChangePasswordModal from "../common/ChangePasswordModal";
import { getCurrentUser, UserInfo } from "../../api/Auth.api";
import { useUserRole } from "../../hooks/useUserRole";

export default function UserInfoCard() {
  const { isAdmin } = useUserRole();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user information from API
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        const user = await getCurrentUser();
        setUserInfo(user);
      } catch (err: any) {
        console.error("Error fetching user info:", err);
        setError(err.response?.data?.detail || "Failed to load user information");
        // Set fallback values
        setUserInfo({
          id: 0,
          email: "Loading...",
          role: "viewer",
          is_active: false,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  // User data for the modal
  const currentUser = userInfo
    ? {
        id: userInfo.id,
        name: userInfo.email.split("@")[0],
        email: userInfo.email,
        role: userInfo.role === "admin" ? "Administrator" : "Viewer",
        department: "Engineering",
        phone: "+1234567890",
        joinDate: "2024-01-01",
        status: userInfo.is_active ? ("active" as const) : ("inactive" as const),
      }
    : {
        id: 0,
        name: "Loading...",
        email: "Loading...",
        role: "Viewer",
        department: "Engineering",
        phone: "+1234567890",
        joinDate: "2024-01-01",
        status: "active" as const,
      };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-900/60 dark:to-gray-900/80 shadow-sm hover:shadow-md transition-all duration-300 lg:p-8 p-6">
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 via-transparent to-purple-50/0 dark:from-indigo-900/5 dark:via-transparent dark:to-purple-900/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full bg-gradient-to-b from-indigo-500 to-purple-600"></div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                Reset Password
              </h4>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 2xl:gap-8">
            {/* Email */}
            <div className="group/item rounded-xl p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/60 dark:to-gray-800/40 border border-gray-200/50 dark:border-gray-700/50 hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-all duration-200">
              <p className="mb-3 text-xs font-medium leading-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Email Address
              </p>
              {loading ? (
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 animate-pulse">
                  Loading...
                </p>
              ) : error ? (
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : (
                <p className="text-sm font-semibold text-gray-900 dark:text-white/95 truncate">
                  {userInfo?.email || "N/A"}
                </p>
              )}
            </div>

            {/* Role */}
            <div className="group/item rounded-xl p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/60 dark:to-gray-800/40 border border-gray-200/50 dark:border-gray-700/50 hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-all duration-200">
              <p className="mb-3 text-xs font-medium leading-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Role
              </p>
              {loading ? (
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 animate-pulse">
                  Loading...
                </p>
              ) : (
                <p className="text-sm font-semibold text-gray-900 dark:text-white/95">
                  {userInfo?.role === "admin" ? "Administrator" : "Viewer"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Reset Password Button */}
        <div className="flex-shrink-0 w-full lg:w-auto">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-200 hover:-translate-y-0.5 dark:hover:shadow-indigo-500/20 lg:inline-flex lg:w-auto"
            aria-label="Reset password"
          >
            <svg
              className="fill-current"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z"
                fill=""
              />
            </svg>
            Reset Password
          </button>
        </div>
      </div>

      {/* Use the reusable ChangePasswordModal component */}
      {isModalOpen && (
        <ChangePasswordModal
          user={currentUser}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
