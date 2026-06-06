import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "/src/context/useAuth.jsx";
import {
  Phone,
  User,
  Mail,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Check,
  Zap,
  MessageSquare,
  Layout,
  Rocket,
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Register = () => {
  const [step, setStep] = useState(1); // 1: Details, 2: OTP
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    email: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const { sendRegisterOtp, verifyRegisterOtp } = useAuth();
  const navigate = useNavigate();
  const otpRefs = useRef([]);

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

  // Handle Details Submit
  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (formData.phoneNumber.length < 10) throw new Error("Please enter a valid phone number");

      // Password Validation
      if (formData.password.length < 6) throw new Error("Password must be at least 6 characters long");

      const res = await sendRegisterOtp(formData.phoneNumber);

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

  // Handle OTP Resend
  const handleResendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await sendRegisterOtp(formData.phoneNumber);
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

  // Handle OTP Verification
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
      await verifyRegisterOtp(
        formData.fullName,
        formData.email,
        formData.phoneNumber,
        otpCode,
        formData.password
      );

      navigate("/");

    } catch (err) {
      setError(err.response?.data?.error || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  // OTP Input Logic
  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next
    if (value && index < 5) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-white font-sans selection:bg-blue-100 selection:text-blue-900">

      {/* LEFT SIDE – 50% SPLIT */}
      <div className="hidden lg:flex w-1/2 h-full bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] items-center justify-center p-[60px] relative overflow-hidden">
        {/* Subtle decorative shapes */}
        <div className="absolute top-0 right-0 w-[40%] h-full bg-white/10 skew-x-[-15deg] translate-x-1/2"></div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-[520px] relative z-10"
        >
          {/* Top Badge */}
          <div className="inline-flex items-center px-4 py-1.5 bg-blue-100 rounded-full text-blue-700 font-bold text-sm mb-8 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
            <Rocket size={16} className="mr-2" /> Zepofy Platform
          </div>

          {/* Headline */}
          <h1 className="text-[40px] font-bold text-slate-900 leading-[1.2] mb-6">
            Build Stronger<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">Customer Relationships.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-[17px] text-slate-600 leading-relaxed mb-10 font-medium">
            Create your account and start automating WhatsApp conversations in minutes. Join thousands of businesses scaling effortlessly.
          </p>

          {/* Feature Cards Stacks */}
          <div className="flex flex-col gap-4 mb-10">
            {[
              { icon: Zap, text: "Increase Customer Retention", color: "text-amber-500", bg: "bg-amber-50" },
              { icon: MessageSquare, text: "Send Personalized Campaigns", color: "text-blue-500", bg: "bg-blue-50" },
              { icon: Layout, text: "Drive Repeat Sales Effortlessly", color: "text-blue-500", bg: "bg-blue-50" }
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
                <Check className="ml-auto text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" size={20} strokeWidth={3} />
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
          <div className="w-full max-w-[480px] bg-white rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] border border-slate-200 p-10 flex flex-col justify-between min-h-[620px]">

            {/* Header Area */}
            <div className="flex flex-col mb-10 text-left w-full">
              <h2 className="text-[32px] font-bold text-slate-900 mb-3 tracking-tight">
                {step === 1 ? "Create Account 🚀" : "Verify Phone 📱"}
              </h2>
              <p className="text-slate-500 text-[15px] font-medium leading-relaxed">
                {step === 1
                  ? "Enter your details to get started with Zepofy."
                  : `We sent a 6-digit verification code to +${formData.phoneNumber.replace(/.(?=.{4})/g, '*')}`
                }
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

            {/* Form Steps */}
            <div className="flex-1">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.form
                    key="details"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleDetailsSubmit}
                    className="space-y-4"
                  >
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-blue-500 transition-colors">
                          <User size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                          type="text"
                          placeholder="Hardik Gohil"
                          className="w-full h-[48px] pl-11 pr-4 bg-slate-50 border-2 border-transparent rounded-[12px] font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-300 text-sm"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-blue-500 transition-colors">
                          <Mail size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                          type="email"
                          placeholder="hardik@example.com"
                          className="w-full h-[48px] pl-11 pr-4 bg-slate-50 border-2 border-transparent rounded-[12px] font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-300 text-sm"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    {/* Mobile Number */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-blue-500 transition-colors">
                          <Phone size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                          type="tel"
                          placeholder="919876543210"
                          className="w-full h-[48px] pl-11 pr-4 bg-slate-50 border-2 border-transparent rounded-[12px] font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-300 text-sm"
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    {/* Password Field */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-blue-500 transition-colors">
                          <Lock size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="w-full h-[48px] pl-11 pr-11 bg-slate-50 border-2 border-transparent rounded-[12px] font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-300 text-sm"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
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
                      {loading ? <Loader2 className="animate-spin" /> : <>Continue <ArrowRight size={18} /></>}
                    </button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="otp"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleOtpSubmit}
                    className="space-y-10"
                  >
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
                      className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-[14px] shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <>Verify & Create Account <CheckCircle size={18} /></>}
                    </button>

                    <div className="flex items-center justify-between text-[13px] font-bold">
                      <button type="button" onClick={() => { setStep(1); setOtp(["", "", "", "", "", ""]); setError(""); }} className="text-slate-400 hover:text-slate-900 transition-colors cursor-pointer">
                        Adjust Details
                      </button>
                      {canResend ? (
                        <button type="button" onClick={handleResendOtp} className="text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors cursor-pointer">
                          <RefreshCw size={14} /> Resend OTP
                        </button>
                      ) : (
                        <span className="text-slate-300">Resend in <span className="text-slate-900 tabular-nums">{timer}s</span></span>
                      )}
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="mt-10 pt-8 border-t border-slate-50 text-center">
              <p className="text-slate-500 text-[15px] font-medium">
                Already have an account?{" "}
                <Link to="/login" className="text-blue-600 font-bold hover:text-blue-800 transition-colors underline-offset-4 hover:underline cursor-pointer">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
