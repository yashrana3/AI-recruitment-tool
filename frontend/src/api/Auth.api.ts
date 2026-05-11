import axios from "axios";
import axiosClient, { API_BASE_URL } from "./axiosClient";

export interface SignUpParams {
  email: string;
  password: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface ChangePasswordParams {
  old_password: string;
  new_password: string;
}

export interface CreateUserParams {
  email: string;
  password: string;
  role: "admin" | "viewer";
}

export interface AdminChangePasswordParams {
  user_id: number;
  new_password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface UserInfo {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
}

// Create a separate axios instance for auth that doesn't use interceptors
const authClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,
});

export const signUp = async (params: SignUpParams): Promise<AuthResponse> => {
  try {
    console.log("📝 SignUp request:", params.email);
    const response = await authClient.post("/auth/signup", params);
    console.log("✅ SignUp success:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error signing up:", error);
    throw error;
  }
};

export const signIn = async (params: SignInParams): Promise<AuthResponse> => {
  try {
    console.log("🔐 SignIn request:", params.email);
    const response = await authClient.post("/auth/signin", params);
    console.log("✅ SignIn success, token received:", response.data.access_token?.substring(0, 20) + "...");
    return response.data;
  } catch (error) {
    console.error("❌ Error signing in:", error);
    throw error;
  }
};

// Change password requires authentication, so use axiosClient with token
export const changePassword = async (
  params: ChangePasswordParams
): Promise<string> => {
  try {
    console.log("🔒 ChangePassword request");
    console.log("📋 Params:", { old_password: "***", new_password: "***" });
    console.log("🔑 Token in localStorage:", localStorage.getItem("token") ? "EXISTS" : "MISSING");
    
    const response = await axiosClient.post("/auth/change-password", params);
    
    console.log("✅ ChangePassword success:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ Error changing password:", error);
    console.error("❌ Error response:", error.response?.data);
    console.error("❌ Error status:", error.response?.status);
    throw error;
  }
};

export const createUser = async (params: CreateUserParams): Promise<any> => {
  try {
    console.log("👤 CreateUser request:", params.email);
    const response = await axiosClient.post("/auth/create-user", params);
    console.log("✅ CreateUser success:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ Error creating user:", error);
    throw error;
  }
};

export const getUsers = async (): Promise<any[]> => {
  try {
    const response = await axiosClient.get("/auth/users");
    return response.data;
  } catch (error: any) {
    console.error("❌ Error fetching users:", error);
    throw error;
  }
};

export const adminChangePassword = async (
  params: AdminChangePasswordParams
): Promise<any> => {
  try {
    console.log("🔒 AdminChangePassword request for user:", params.user_id);
    const response = await axiosClient.post("/auth/admin/change-password", params);
    console.log("✅ AdminChangePassword success:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ Error changing password:", error);
    throw error;
  }
};

export const deleteUser = async (user_id: number): Promise<any> => {
  try {
    console.log("🗑️ DeleteUser request for user:", user_id);
    const response = await axiosClient.delete(`/auth/user/${user_id}`);
    console.log("✅ DeleteUser success:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ Error deleting user:", error);
    throw error;
  }
};

export const getCurrentUser = async (): Promise<UserInfo> => {
  try {
    console.log("👤 GetCurrentUser request");
    const response = await axiosClient.get("/auth/me");
    console.log("✅ GetCurrentUser success:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ Error fetching current user:", error);
    throw error;
  }
};