import axios from "axios";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_SERVER_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// 🔐 REQUEST INTERCEPTOR (JWT ATTACH)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 🚨 RESPONSE INTERCEPTOR (OPTIONAL BUT RECOMMENDED)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Auto logout on auth failure
    if (error.response?.status === 401) {
      console.warn("🔐 Unauthorized – token invalid or expired");
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    // 💳 Handle Subscription Expiry
    if (error.response?.status === 403 && error.response?.data?.code === "SUBSCRIPTION_EXPIRED") {
      console.warn("💳 Subscription Expired");
      localStorage.removeItem("token");
      window.location.href = "/login?expired=true";
    }

    return Promise.reject(error);
  }
);

export default api;
