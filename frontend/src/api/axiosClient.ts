import axios from "axios";

// Get API base URL from environment variables
// Vite exposes env variables prefixed with VITE_ via import.meta.env
// .env.local (for local development) or .env.production (for production builds)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,
});

// Request interceptor to add token to headers
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    
    // Only exclude signin from requiring token
    const isPublicAuthEndpoint = 
      config.url?.includes("/auth/signin");

    if (token && !isPublicAuthEndpoint) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (!token && !isPublicAuthEndpoint) {
      // If no token and not a public auth endpoint, redirect to signin
      if (window.location.pathname !== "/signin") {
        window.location.href = "/signin";
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors
axiosClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Remove token and redirect to signin
      localStorage.removeItem("token");
      if (window.location.pathname !== "/signin") {
        window.location.href = "/signin";
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
