import { useState, useRef, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "/src/context/useAuth.jsx";
import {
  Phone,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Mail,
  Lock,
  Zap,
  MessageSquare,
  TrendingUp,
  Eye,
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Login = () => {
  const [activeTab, setActiveTab] = useState("otp"); // 'otp' or 'email'
  const [showPassword, setShowPassword] = useState(false);

  // OTP State
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Password State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { sendLoginOtp, verifyLoginOtp, loginPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const otpRefs = useRef([]);

  // Check for expiration redirect
  useEffect(() => {
    if (searchParams.get("expired") === "true") {
      setError("Your subscription has expired. Please log in to upgrade your plan.");
    }
  }, [searchParams]);

  // Timer Logic
  useEffect(() => {
    let interval;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // --- OTP HANDLERS ---
  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (phoneNumber.length < 10) throw new Error("Please enter a valid phone number");
      const res = await sendLoginOtp(phoneNumber);
      if (res.devOtp) alert(`DEV OTP: ${res.devOtp}`);
      setStep(2);
      setTimer(60);
      setCanResend(false);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await sendLoginOtp(phoneNumber);
      if (res.devOtp) alert(`DEV OTP: ${res.devOtp}`);
      setTimer(60);
      setCanResend(false);
      setOtp(["", "", "", "", "", ""]);
    } catch (err) {
      setError("Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      setError("Please enter the full 6-digit OTP");
      setLoading(false);
      return;
    }
    try {
      const user = await verifyLoginOtp(phoneNumber, otpCode);
      if (user.role === 'superadmin') navigate("/master/dashboard");
      else navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1].focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  // --- PASSWORD HANDLER ---
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await loginPassword(email, password);
      if (user.role === 'superadmin') navigate("/master/dashboard");
      else navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-white font-sans selection:bg-blue-100 selection:text-blue-900">

      {/* LEFT SIDE – 50% SPLIT */}
      <div className="hidden lg:flex w-1/2 h-full bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] items-center justify-center p-[60px] relative overflow-hidden">
        {/* Subtle decorative shapes */}
        <div className="absolute top-0 right-0 w-[40%] h-full bg-white/10 skew-x-[-15deg] translate-x-1/2"></div>
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-blue-200/20 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2"></div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-[520px] relative z-10"
        >
          {/* Top Badge */}
          <div className="inline-flex items-center px-4 py-1.5 bg-blue-100 rounded-full text-blue-700 font-bold text-sm mb-8 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
            Zepofy Platform
          </div>

          {/* Headline */}
          <h1 className="text-[40px] font-bold text-slate-900 leading-[1.2] mb-6">
            Automate Conversations.<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">Accelerate Growth.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-[17px] text-slate-600 leading-relaxed mb-10 font-medium">
            Powerful WhatsApp automation designed to help modern businesses engage customers, recover lost revenue, and scale effortlessly.
          </p>

          {/* Feature Cards Stacks */}
          <div className="flex flex-col gap-4 mb-10">
            {[
              { icon: Zap, text: "Launch Smart Campaigns in Minutes", color: "text-amber-500", bg: "bg-amber-50" },
              { icon: MessageSquare, text: "Centralize Customer Conversations", iconText: "💬", color: "text-blue-500", bg: "bg-blue-50" },
              { icon: TrendingUp, text: "Recover Lost Sales Automatically", color: "text-blue-500", bg: "bg-blue-50" }
            ].map((feature, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -3, cursor: 'pointer' }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + (i * 0.1) }}
                className="flex items-center gap-4 bg-white p-4 rounded-[16px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-white/50 transition-all hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] group"
              >
                <div className={`w-11 h-11 rounded-[12px] ${feature.bg} flex items-center justify-center`}>
                  <feature.icon size={22} className={feature.color} />
                </div>
                <span className="text-[16px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                  {feature.text}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Trust line */}
          <div className="text-slate-500 text-[13px] font-bold uppercase tracking-[2px] opacity-60">
            Trusted by fast-growing brands across India
          </div>
        </motion.div>
      </div>

      {/* RIGHT SIDE – 50% SPLIT */}
      <div className="w-full lg:w-1/2 h-full flex items-center justify-center p-[60px] bg-white overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[480px] flex flex-col items-center"
        >
          {/* Main Form Card */}
          <div className="w-full bg-white rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] border border-slate-200 p-10 flex flex-col">
            {/* Header Area */}
            <div className="flex flex-col items-center text-center mb-10">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-5 border border-blue-100 shadow-inner">
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-[28px] font-bold text-slate-900 mb-2">Secure Login</h2>
              <p className="text-slate-500 text-[15px] font-medium leading-relaxed max-w-[320px]">
                Access your dashboard instantly via WhatsApp OTP or Email.
              </p>
            </div>

            {/* ERROR ALERT */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 p-4 bg-red-50 border border-red-100 rounded-[12px] flex items-start gap-3 overflow-hidden"
                >
                  <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
                  <p className="text-sm text-red-600 font-bold leading-tight">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TAB TOGGLE */}
            <div className="h-[48px] bg-slate-100 rounded-full flex p-1 relative mb-10 cursor-pointer">
              <div
                className={`absolute top-1 left-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow-md transition-transform duration-300 ease-out ${activeTab === 'email' ? 'translate-x-full' : 'translate-x-0'}`}
              ></div>
              <button
                onClick={() => { setActiveTab("otp"); setError(""); }}
                className={`flex-1 flex items-center justify-center gap-2.5 text-sm font-bold relative z-10 transition-colors duration-300 ${activeTab === 'otp' ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Phone size={16} /> OTP Login
              </button>
              <button
                onClick={() => { setActiveTab("email"); setError(""); }}
                className={`flex-1 flex items-center justify-center gap-2.5 text-sm font-bold relative z-10 transition-colors duration-300 ${activeTab === 'email' ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Mail size={16} /> Email Login
              </button>
            </div>

            {/* Form Transitions */}
            <div className="h-[260px]">
              <AnimatePresence mode="wait">
                {activeTab === "otp" ? (
                  <motion.div
                    key="otp"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {step === 1 ? (
                      <form onSubmit={handlePhoneSubmit} className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-blue-500 transition-colors">
                              <Phone size={20} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                              type="tel"
                              placeholder="919876543210"
                              className="w-full h-[52px] pl-12 pr-4 bg-slate-50 border-2 border-transparent rounded-[14px] font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-300"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              autoFocus
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-[14px] shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0 cursor-pointer mt-4"
                        >
                          {loading ? <Loader2 className="animate-spin" /> : <>Get OTP <ArrowRight size={18} /></>}
                        </button>

                        {/* Trust Badge / Space Filler */}
                        <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 border border-slate-100">
                            <ShieldCheck size={18} className="text-blue-500" />
                          </div>
                          <div className="flex-1 pt-0.5">
                            <h4 className="text-[13px] font-bold text-slate-800 leading-none mb-1.5">Secure Authentication</h4>
                            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">We'll send a one-time password to verify your identity. Your data is encrypted and secure.</p>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleOtpSubmit} className="space-y-10">
                        <div className="space-y-5">
                          <label className="text-[12px] font-bold text-slate-400 uppercase tracking-widest text-center block">Enter 6-digit Code</label>
                          <div className="flex gap-2.5 justify-between">
                            {otp.map((digit, index) => (
                              <input
                                key={index}
                                ref={(el) => (otpRefs.current[index] = el)}
                                type="text"
                                maxLength="1"
                                className={`w-full max-w-[56px] h-14 text-center text-2xl font-bold rounded-[12px] border-2 outline-none transition-all duration-200 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] ${digit
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-slate-50 focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 focus:bg-white'
                                  }`}
                                value={digit}
                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                              />
                            ))}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-[14px] shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
                        >
                          {loading ? <Loader2 className="animate-spin" /> : <>Verify & Login <CheckCircle size={18} /></>}
                        </button>

                        <div className="flex items-center justify-between text-[13px] font-bold">
                          <button type="button" onClick={() => { setStep(1); setOtp(["", "", "", "", "", ""]); setError(""); }} className="text-slate-400 hover:text-slate-900 transition-colors cursor-pointer">
                            Change Number
                          </button>
                          {canResend ? (
                            <button type="button" onClick={handleResendOtp} className="text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors cursor-pointer">
                              <RefreshCw size={14} /> Resend OTP
                            </button>
                          ) : (
                            <span className="text-slate-300">Resend in <span className="text-slate-900 tabular-nums">{timer}s</span></span>
                          )}
                        </div>
                      </form>
                    )}
                  </motion.div>
                ) : (
                  <motion.form
                    key="email"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handlePasswordSubmit}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-blue-500 transition-colors">
                          <Mail size={20} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                          type="email"
                          placeholder="name@company.com"
                          className="w-full h-[52px] pl-12 pr-4 bg-slate-50 border-2 border-transparent rounded-[14px] font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-300"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Password</label>
                      </div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-blue-500 transition-colors">
                          <Lock size={20} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="w-full h-[52px] pl-12 pr-12 bg-slate-50 border-2 border-transparent rounded-[14px] font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-300"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-[14px] shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <>Sign In <ArrowRight size={18} /></>}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="mt-10 pt-8 border-t border-slate-50 text-center">
              <p className="text-slate-500 text-[15px] font-medium">
                New to Zepofy?{" "}
                <Link to="/register" className="text-blue-600 font-bold hover:text-blue-800 transition-colors underline-offset-4 hover:underline cursor-pointer">
                  Create Account
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
