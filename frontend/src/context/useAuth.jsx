import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* 🔥 LOAD USER ON REFRESH */
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data.user);
      })
      .catch(() => {
        localStorage.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  /* 📝 REGISTER FLOW */
  const sendRegisterOtp = async (phoneNumber) => {
    const res = await api.post("/auth/send-register-otp", { phoneNumber });
    return res.data;
  };

  const verifyRegisterOtp = async (fullName, email, phoneNumber, otp, password) => {
    const res = await api.post("/auth/verify-register-otp", { fullName, email, phoneNumber, otp, password });

    localStorage.setItem("token", res.data.token);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    setUser(res.data.user);

    return res.data.user;
  };

  /* 🔐 LOGIN FLOW */
  const sendLoginOtp = async (phoneNumber) => {
    const res = await api.post("/auth/send-login-otp", { phoneNumber });
    return res.data;
  };

  const verifyLoginOtp = async (phoneNumber, otp) => {
    const res = await api.post("/auth/verify-login-otp", { phoneNumber, otp });

    localStorage.setItem("token", res.data.token);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    setUser(res.data.user);

    return res.data.user;
  };

  /* 🔑 PASSWORD LOGIN FLOW */
  const loginPassword = async (email, password) => {
    const res = await api.post("/auth/login-password", { email, password });

    localStorage.setItem("token", res.data.token);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    setUser(res.data.user);

    return res.data.user;
  };

  /* 🚪 LOGOUT */
  const logout = () => {
    localStorage.clear();
    setUser(null);
    window.location.href = "/login";
  };

  /* 🔄 REFRESH USER DATA */
  const refreshUser = async () => {
    try {
      const res = await api.get("/auth/me");
      if (res.data.user) {
        setUser(res.data.user);
        localStorage.setItem("user", JSON.stringify(res.data.user));
      }
      return res.data.user;
    } catch (err) {
      console.error("Failed to refresh user:", err);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        refreshUser,
        sendRegisterOtp,
        verifyRegisterOtp,
        sendLoginOtp,
        verifyLoginOtp,
        loginPassword,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
