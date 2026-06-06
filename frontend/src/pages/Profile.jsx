import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import api from "../api/api";
import {
  Camera,
  User,
  Mail,
  Lock,
  Smartphone,
  Calendar,
  Clock,
  LogOut,
  Trash2,
  Eye,
  EyeOff,
  Hash,
  Shield,
  ArrowLeft,
  Loader2,
  CheckCircle,
  X,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Key
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { getImageUrl } from "../utils/imageHelpers";

const Profile = () => {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();

  // Profile Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({
    new: "",
    confirm: ""
  });
  const [showPass, setShowPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load user data
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPreview(user.profileImage || user.photo || null);
    }
  }, [user]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      setPhoto(file);
      setPreview(URL.createObjectURL(file));
    } else if (file) {
      toast.error('File size must be less than 5MB');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const form = new FormData();
      form.append("name", name);
      form.append("email", email);
      if (photo) form.append("photo", photo);

      const res = await api.put("/auth/profile", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUser(res.data.user);
      setPhoto(null);
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Update failed");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) return toast.error("Passwords do not match");
    if (passwords.new.length < 6) return toast.error("Minimum 6 characters required");

    setIsChangingPass(true);
    try {
      await api.put("/auth/profile/password", {
        newPassword: passwords.new
      });
      toast.success("Password changed successfully");
      setShowPasswordModal(false);
      setPasswords({ new: "", confirm: "" });
    } catch (err) {
      toast.error(err.response?.data?.error || "Password update failed");
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await api.delete("/auth/profile");
      toast.success("Account deleted permanently");
      logout();
    } catch (err) {
      toast.error(err.response?.data?.error || "Deletion failed");
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6 lg:p-10 font-poppins selection:bg-blue-100 overflow-x-hidden">
      <div className="max-w-[1500px] mx-auto">

        {/* Header - COMPACT with Sign Out at Top */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-all shadow-sm active:scale-95"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 leading-none">My Profile</h1>
              <p className="text-slate-400 text-xs mt-1.5 font-medium">Manage your personal information and account security.</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="group flex items-center gap-3 px-5 py-3 bg-white border border-slate-100 rounded-2xl text-slate-600 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm font-bold active:scale-95"
          >
            <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-rose-100 transition-colors">
              <LogOut size={18} />
            </div>
            <span className="text-sm">Sign Out</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT CARD - Summary (lg:4) */}
          <div className="lg:col-span-4 space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-8 flex flex-col items-center"
            >
              <div className="relative group mb-6">
                <div className="w-40 h-40 rounded-full overflow-hidden border-[6px] border-slate-50 shadow-inner group-hover:scale-105 transition-transform duration-500">
                  <img
                    src={getImageUrl(preview) || "https://i.ibb.co/MBtjqXQ/no-avatar.gif"}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                    <Camera className="text-white drop-shadow-md" size={28} />
                  </div>
                </div>
                <label className="absolute bottom-2 right-2 bg-blue-600 text-white p-2.5 rounded-xl shadow-xl border-4 border-white cursor-pointer hover:bg-blue-700 hover:scale-110 transition-all active:scale-90">
                  <Camera size={18} />
                  <input type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                </label>
              </div>

              <div className="text-center space-y-1.5 mb-8">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{user?.name || "User Name"}</h2>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{user?.role || 'User'}</p>
                </div>
              </div>

              <div className="w-full space-y-3 pb-8 border-b border-slate-50 mb-8">
                <div className="flex justify-center">
                  <span className="px-5 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-blue-100/50">
                    {user?.role || 'USER'} Account
                  </span>
                </div>
              </div>

              <div className="w-full">
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="w-full py-4 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-slate-600 font-bold hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all flex items-center justify-center gap-3 active:scale-[0.98] text-sm"
                >
                  <Lock size={16} />
                  Change Password
                </button>
              </div>
            </motion.div>
          </div>

          {/* RIGHT CARD - Personal Details Form (lg:8) */}
          <div className="lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-8 flex flex-col"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600"><Shield size={20} /></div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Personal Details</h3>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">

                  {/* Full Name */}
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <div className="relative group">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-slate-50/50 border-2 border-transparent rounded-2xl text-slate-900 font-bold focus:bg-white focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-slate-300 text-sm"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative group">
                      <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="email"
                        value={email}
                        readOnly
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-400 font-bold cursor-not-allowed outline-none text-sm"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <div className="relative group">
                      <Smartphone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="tel"
                        value={user?.phoneNumber ? `+${user.phoneNumber}` : ""}
                        readOnly
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-400 font-bold cursor-not-allowed outline-none text-sm"
                        placeholder="Not connected"
                      />
                    </div>
                  </div>

                  {/* Account Role */}
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Role</label>
                    <div className="relative group">
                      <Shield size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="text"
                        value={user?.role?.toUpperCase() || "USER"}
                        readOnly
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-400 font-bold cursor-not-allowed outline-none text-sm"
                      />
                    </div>
                  </div>

                  {/* Metadata Compact */}
                  <div className="md:col-span-2 pt-4 flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    <div className="flex-1 min-w-[120px] p-4 bg-slate-50/50 rounded-2xl border border-slate-50">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1">Account ID</p>
                      <p className="text-xs font-bold text-slate-900">#{user?._id?.slice(-6).toUpperCase() || 'N/A'}</p>
                    </div>
                    <div className="flex-1 min-w-[120px] p-4 bg-slate-50/50 rounded-2xl border border-slate-50">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1">Member Since</p>
                      <p className="text-xs font-bold text-slate-900">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '2026'}</p>
                    </div>
                    <div className="flex-1 min-w-[120px] p-4 bg-slate-50/50 rounded-2xl border border-slate-50">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1">Last Login</p>
                      <p className="text-xs font-bold text-slate-900">{user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Today'}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-2 text-rose-500 hover:text-rose-600 font-bold text-xs uppercase tracking-widest transition-colors px-4 py-2 hover:bg-rose-50 rounded-xl"
                  >
                    <Trash2 size={14} />
                    Delete Account
                  </button>

                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full sm:w-auto px-10 py-4 bg-gradient-to-br from-blue-600 to-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4)] hover:shadow-[0_15px_35px_-5px_rgba(37,99,235,0.5)] hover:-translate-y-1 active:translate-y-0 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>

        </div>
      </div>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-poppins selection:bg-violet-100">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowPasswordModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[480px] bg-white rounded-[40px] border border-slate-100 shadow-2xl p-8 md:p-10 overflow-hidden"
            >
              <div className="flex flex-col items-center mb-10">
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center shadow-inner">
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm border border-blue-100/50">
                      <ShieldCheck className="text-blue-500" size={32} />
                    </div>
                  </div>
                  <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-[3px] border-white shadow-sm" />
                </div>

                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-3 text-center">Change Password</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center max-w-[280px] leading-relaxed">
                  SET A NEW PASSWORD FOR YOUR ACCOUNT SECURELY.
                </p>

                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="absolute top-8 right-8 text-slate-300 hover:text-slate-500 transition-colors bg-slate-50 p-2 rounded-2xl"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-6 md:space-y-8">
                <div className="space-y-2.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                  <div className="relative group">
                    <Shield size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      value={passwords.new}
                      onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      className="w-full pl-14 pr-14 py-4 bg-slate-50/50 border-2 border-transparent rounded-2xl text-slate-900 focus:bg-white focus:border-blue-500/20 outline-none transition-all placeholder:text-slate-300 font-bold"
                      placeholder="New password"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-lg">
                      {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Password</label>
                  <div className="relative group">
                    <Shield size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      className="w-full pl-14 pr-14 py-4 bg-slate-50/50 border-2 border-transparent rounded-2xl text-slate-900 focus:bg-white focus:border-blue-500/20 outline-none transition-all placeholder:text-slate-300 font-bold"
                      placeholder="Confirm new password"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-lg">
                      {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    type="submit"
                    disabled={isChangingPass}
                    className="w-full py-5 bg-blue-50 text-blue-600 font-black uppercase tracking-widest rounded-2xl shadow-sm hover:bg-blue-600 hover:text-white hover:shadow-blue-200 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50 group"
                  >
                    {isChangingPass ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw className="group-hover:rotate-180 transition-transform duration-500" size={20} />}
                    Change Password
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="text-center font-black text-[10px] text-slate-400 hover:text-slate-900 uppercase tracking-[0.3em] transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[40px] border border-slate-100 shadow-2xl p-10"
            >
              <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 text-center mb-3">Delete Account?</h3>
              <p className="text-slate-500 text-center mb-10 px-4 font-medium leading-relaxed">This action is permanent and all your data will be wiped out. Are you sure?</p>

              <div className="flex flex-col gap-4">
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="w-full py-5 bg-rose-600 text-white font-black uppercase tracking-widest rounded-3xl shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                  Confirm Deletion
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="w-full py-5 bg-slate-100 text-slate-600 font-bold rounded-3xl hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Profile;
