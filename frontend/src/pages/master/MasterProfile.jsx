import React, { useState } from 'react';
import {
    User,
    Mail,
    Lock,
    Save,
    CheckCircle2,
    AlertCircle,
    Shield,
    Key,
    RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';

const MasterProfile = () => {
    const { user, setUser } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        setLoading(true);

        try {
            const res = await api.put('/superadmin/profile', { name, email, password });
            if (res.data.success) {
                setUser({ ...user, ...res.data.data });
                setMessage({ type: 'success', text: 'Master Profile updated successfully' });
                if (password) setPassword('');
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update profile' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Security Control</h1>
                <p className="text-slate-500 font-medium text-sm mt-1">Manage superadmin credentials and root access settings</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Side - Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-[32px] p-8 text-center shadow-[0px_4px_12px_rgba(0,0,0,0.05)] relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>
                        <div className="w-24 h-24 bg-indigo-50 border-4 border-white rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-xl relative z-10">
                            <span className="text-3xl font-black text-indigo-600">{user?.name?.[0]?.toUpperCase()}</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">{user?.name}</h2>
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20">
                            <Shield size={10} /> Root Admin
                        </div>
                        <p className="mt-6 text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed px-4">
                            You have full kernel-level access to the entire platform.
                        </p>
                    </div>

                    <div className="bg-indigo-900 rounded-[32px] p-8 text-white shadow-xl shadow-indigo-900/10">
                        <div className="p-3 bg-white/10 rounded-[12px] w-fit mb-6">
                            <Key className="text-indigo-300" size={24} />
                        </div>
                        <h3 className="text-lg font-bold mb-2">Password Security</h3>
                        <p className="text-indigo-200/70 text-sm leading-relaxed">
                            Leaving the password field blank will keep your current root credentials unchanged.
                        </p>
                    </div>
                </div>

                {/* Right Side - Form */}
                <div className="lg:col-span-2">
                    <div className="bg-white border border-slate-200 rounded-[32px] p-10 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] relative">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            {message.text && (
                                <div className={`flex items-center gap-4 p-5 rounded-[12px] border ${message.type === 'success' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-rose-50 border-rose-100 text-rose-700'
                                    }`}>
                                    {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                                    <span className="font-bold text-sm">{message.text}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin Full Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-[20px] pl-14 pr-6 py-4.5 text-slate-900 font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">System Root Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-[20px] pl-14 pr-6 py-4.5 text-slate-900 font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Change Access Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                    <input
                                        type="password"
                                        placeholder="Enter new kernel password (min 8 chars)..."
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-[20px] pl-14 pr-6 py-4.5 text-slate-900 font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold mt-2 ml-1 italic">* Leave empty if you do not wish to rotate credentials</p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-5 bg-indigo-600 text-white font-black rounded-[12px] text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {loading ? <RefreshCw size={20} /> : <Save size={20} />}
                                {loading ? 'Committing Changes...' : 'Save Kernel Settings'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MasterProfile;
