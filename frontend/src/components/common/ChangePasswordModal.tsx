import { useState, useMemo } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { changePassword, adminChangePassword } from "../../api/Auth.api";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
  phone?: string;
  joinDate?: string;
  status: "active" | "inactive";
  lastLogin?: string;
}

interface ChangePasswordModalProps {
  user: User;
  onClose: () => void;
  isAdmin?: boolean; // If true, admin is changing another user's password
}

export default function ChangePasswordModal({
  user,
  onClose,
  isAdmin = false,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*]/.test(password);

    return {
      minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      hasSpecialChar,
      isValid:
        minLength &&
        hasUpperCase &&
        hasLowerCase &&
        hasNumber &&
        hasSpecialChar,
    };
  };

  // ✅ Memoize password validation - only recalculate when newPassword changes
  const passwordValidation = useMemo(() => {
    return validatePassword(newPassword);
  }, [newPassword]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Admin doesn't need current password
    if (!isAdmin && !currentPassword) {
      setMessage({ type: "error", text: "Current password is required" });
      return;
    }

    if (!newPassword || !confirmPassword) {
      setMessage({ type: "error", text: "New password fields are required" });
      return;
    }

    // Relaxed validation for admin (min 6 chars) vs user (strict requirements)
    if (isAdmin) {
      if (newPassword.length < 6) {
        setMessage({
          type: "error",
          text: "Password must be at least 6 characters long",
        });
        return;
      }
    } else {
      if (!passwordValidation.isValid) {
        setMessage({
          type: "error",
          text: "Password does not meet requirements",
        });
        return;
      }

      if (currentPassword === newPassword) {
        setMessage({
          type: "error",
          text: "New password must be different from current password",
        });
        return;
      }
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    setLoading(true);

    try {
      if (isAdmin) {
        // Admin changing another user's password
        await adminChangePassword({
          user_id: user.id,
          new_password: newPassword,
        });
      } else {
        // User changing their own password
        await changePassword({
          old_password: currentPassword,
          new_password: newPassword,
        });
      }

      setMessage({ type: "success", text: "Password changed successfully!" });
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Failed to change password. Please try again.";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-99999 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Change Password</h2>
              <p className="text-purple-100 text-sm mt-1">{user.name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors duration-200"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {message && (
            <div
              className={`mb-4 p-4 rounded-lg ${
                message.type === "success"
                  ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                  : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
              }`}
            >
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Current Password - Only show for non-admin users */}
            {!isAdmin && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Current Password
                </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                  placeholder="Enter current password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {showCurrentPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>
            )}

            {/* New Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                  placeholder="Enter new password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password Requirements - Only show strict requirements for non-admin */}
              {newPassword && !isAdmin && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Password Requirements:
                  </p>
                  <div className="space-y-1">
                    <div
                      className={`flex items-center gap-2 text-xs ${
                        passwordValidation.minLength
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {passwordValidation.minLength ? (
                        <Check size={14} />
                      ) : (
                        <X size={14} />
                      )}
                      <span>At least 8 characters</span>
                    </div>
                    <div
                      className={`flex items-center gap-2 text-xs ${
                        passwordValidation.hasUpperCase
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {passwordValidation.hasUpperCase ? (
                        <Check size={14} />
                      ) : (
                        <X size={14} />
                      )}
                      <span>One uppercase letter (A-Z)</span>
                    </div>
                    <div
                      className={`flex items-center gap-2 text-xs ${
                        passwordValidation.hasLowerCase
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {passwordValidation.hasLowerCase ? (
                        <Check size={14} />
                      ) : (
                        <X size={14} />
                      )}
                      <span>One lowercase letter (a-z)</span>
                    </div>
                    <div
                      className={`flex items-center gap-2 text-xs ${
                        passwordValidation.hasNumber
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {passwordValidation.hasNumber ? (
                        <Check size={14} />
                      ) : (
                        <X size={14} />
                      )}
                      <span>One number (0-9)</span>
                    </div>
                    <div
                      className={`flex items-center gap-2 text-xs ${
                        passwordValidation.hasSpecialChar
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {passwordValidation.hasSpecialChar ? (
                        <Check size={14} />
                      ) : (
                        <X size={14} />
                      )}
                      <span>One special character (!@#$%^&*)</span>
                    </div>
                  </div>
                </div>
              )}
              {newPassword && isAdmin && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Password must be at least 6 characters long
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                  placeholder="Confirm new password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>

              {/* Password Match Indicator */}
              {/* {confirmPassword && newPassword && (
                <div className="mt-2">
                  {newPassword === confirmPassword ? (
                    <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                      <Check size={14} />
                      <span>Passwords match</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                      <X size={14} />
                      <span>Passwords do not match</span>
                    </div>
                  )}
                </div>
              )} */}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  (!isAdmin && !passwordValidation.isValid) ||
                  (isAdmin && newPassword.length < 6) ||
                  newPassword !== confirmPassword ||
                  (!isAdmin && !currentPassword)
                }
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {loading ? "Updating..." : "Change Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
