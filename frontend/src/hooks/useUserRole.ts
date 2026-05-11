import { useState, useEffect } from "react";
import { getCurrentUser, UserInfo } from "../api/Auth.api";

export function useUserRole() {
  const [userRole, setUserRole] = useState<"admin" | "viewer" | null>(null);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const user = await getCurrentUser();
        setUserInfo(user);
        setUserRole(user.role === "admin" ? "admin" : "viewer");
      } catch (error) {
        console.error("Error fetching user role:", error);
        // Default to viewer on error
        setUserRole("viewer");
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  const isAdmin = userRole === "admin";
  const isViewer = userRole === "viewer";

  return {
    userRole,
    isAdmin,
    isViewer,
    loading,
    userInfo,
  };
}

