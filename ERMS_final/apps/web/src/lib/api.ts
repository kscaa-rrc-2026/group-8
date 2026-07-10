import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("erms_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A stale/expired session should always bounce to /login, not show a
// confusing partial dashboard. A pending mandatory password change bounces
// to /change-password instead — the session itself is still valid.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.error?.code;
    if (code === "MUST_CHANGE_PASSWORD") {
      if (window.location.pathname !== "/change-password") window.location.href = "/change-password";
      return Promise.reject(error);
    }
    if (error.response?.status === 401) {
      localStorage.removeItem("erms_token");
      localStorage.removeItem("erms_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
