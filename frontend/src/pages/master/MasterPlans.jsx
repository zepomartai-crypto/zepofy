import React, { useState, useEffect } from 'react';
import {
    RefreshCw,
    Plus,
    X,
    LayoutDashboard,
    Zap,
    Crown,
    CheckCircle2,
    Search,
    Bell,
    Settings,
    Tag,
    FileText,
    Calendar,
    ChevronRight,
    Users,
    Package,
    ArrowUpRight,
    Filter,
    CreditCard,
    Upload,
    Eye,
    Check,
    Trash2
} from 'lucide-react';
import api from '../../api/api';
import DensitySelector from '../../components/UI/DensitySelector';
import toast from 'react-hot-toast';

const MasterPlans = () => {
    const [activeView, setActiveView] = useState('dashboard'); // 'plans' or 'dashboard'
    const [plans, setPlans] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    
    const [metrics, setMetrics] = useState({
        activeAccounts: 0,
        expiredPlans: 0,
        expiringSoon: 0
    });

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTier, setFilterTier] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterExpiringSoon, setFilterExpiringSoon] = useState(false);

    const [newPlan, setNewPlan] = useState({
        name: '', label: '', price: 0, duration: 30,
        limits: { templateLimit: 10, campaignLimit: 5, contactLimit: 100, messageLimit: 1000, apiLimit: 100 },
        isActive: true, recommended: false
    });

    const [assignmentData, setAssignmentData] = useState({
        userId: '',
        plan: '',
        expiryDate: '',
    });

    const [viewingUser, setViewingUser] = useState(null);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(parseInt(localStorage.getItem('superadmin_plans_density')) || 10);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [plansRes, usersRes, metricsRes] = await Promise.all([
                api.get('/superadmin/plans'),
                api.get('/superadmin/users'),
                api.get('/superadmin/subscription-metrics')
            ]);
            
            if (plansRes.data.success) setPlans(plansRes.data.data);
            if (usersRes.data.success) {
                // Handle both old {data: {users: []}} and new {data: []} structures
                const fetchedUsers = Array.isArray(usersRes.data.data) 
                    ? usersRes.data.data 
                    : (usersRes.data.data?.users || usersRes.data.users || []);
                setUsers(fetchedUsers.filter(u => u.role === 'user'));
            }
            if (metricsRes.data.success) setMetrics(metricsRes.data.data);
        } catch (err) {
            console.error('Fetch error:', err);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreatePlan = async (e) => {
        e.preventDefault();
        if (!newPlan.name?.trim()) return toast.error('Plan Code is required');
        if (!newPlan.label?.trim()) return toast.error('Plan Name is required');

        try {
            setIsUpdating(true);
            const res = await api.post('/superadmin/plans', newPlan);
            if (res.data.success) {
                toast.success('New plan created successfully');
                setShowCreateModal(false);
                setNewPlan({
                    name: '', label: '', price: 0, duration: 30,
                    limits: { templateLimit: 10, campaignLimit: 5, contactLimit: 100, messageLimit: 1000, apiLimit: 100 },
                    isActive: true, recommended: false
                });
                fetchData();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create plan');
        } finally { setIsUpdating(false); }
    };

    const handleUpdatePlan = async (e) => {
        e.preventDefault();
        try {
            setIsUpdating(true);
            const res = await api.put(`/superadmin/plans/${editingPlan._id}`, editingPlan);
            if (res.data.success) {
                toast.success('Plan updated successfully');
                setEditingPlan(null);
                fetchData();
            }
        } catch (err) {
            toast.error('Update fail');
        } finally { setIsUpdating(false); }
    };

    const handleDeletePlan = async (id) => {
        if (!window.confirm('Are you sure you want to delete this plan? This cannot be undone.')) return;
        
        try {
            setIsUpdating(true);
            const res = await api.delete(`/superadmin/plans/${id}`);
            if (res.data.success) {
                toast.success('Plan deleted successfully');
                fetchData();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete plan');
        } finally { setIsUpdating(false); }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = (u.company || u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTier = filterTier === 'ALL' || u.plan === filterTier;
        const matchesStatus = filterStatus === 'ALL' || u.subscriptionStatus === filterStatus;
        
        let matchesExpiry = true;
        if (filterExpiringSoon) {
            const now = new Date();
            const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            matchesExpiry = u.accountExpiry && new Date(u.accountExpiry) > now && new Date(u.accountExpiry) <= sevenDays;
        }

        return matchesSearch && matchesTier && matchesStatus && matchesExpiry;
    });

    const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const handleRowsPerPageChange = (e) => {
        const value = parseInt(e.target.value);
        setRowsPerPage(value);
        setCurrentPage(1);
        localStorage.setItem('superadmin_plans_density', value);
    };

    const handleAssignPlan = async (e) => {
        e.preventDefault();
        
        if (selectedUserIds.length > 0) {
            if (!assignmentData.plan) return toast.error('Select a plan');
            try {
                setIsUpdating(true);
                const res = await api.post('/superadmin/users/bulk-plan', {
                    userIds: selectedUserIds,
                    plan: assignmentData.plan,
                    expiryDate: assignmentData.expiryDate,
                });
                if (res.data.success) {
                    toast.success(res.data.message || `Plan assigned to ${selectedUserIds.length} users`);
                    setShowAssignModal(false);
                    setAssignmentData({ userId: '', plan: '', expiryDate: '' });
                    setSelectedUserIds([]);
                    setUserSearchTerm('');
                    fetchData();
                }
            } catch (err) {
                toast.error('Bulk assignment failed');
            } finally { setIsUpdating(false); }
            return;
        }

        if (!assignmentData.userId) return toast.error('Select a tenant');
        if (!assignmentData.plan) return toast.error('Select a plan');

        try {
            setIsUpdating(true);
            const res = await api.patch(`/superadmin/users/${assignmentData.userId}/plan`, {
                plan: assignmentData.plan,
                expiryDate: assignmentData.expiryDate,
            });
            if (res.data.success) {
                toast.success('Plan assigned successfully');
                setShowAssignModal(false);
                setAssignmentData({ userId: '', plan: '', expiryDate: '' });
                setUserSearchTerm('');
                fetchData();
            }
        } catch (err) {
            toast.error('Assignment failed');
        } finally { setIsUpdating(false); }
    };

    if (loading && plans.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-32">
                <RefreshCw className="text-indigo-600 mb-4" size={40} />
                <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Synchronizing System...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8F7FF] p-8 space-y-8 font-sans">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-[#1E1B4B] tracking-tight">Subscription Management</h1>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Plan Control & Business Fulfillment</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-white rounded-xl p-1.5 shadow-sm border border-slate-100">
                        <button 
                            onClick={() => setActiveView('dashboard')}
                            className={`px-5 py-2 text-xs font-bold flex items-center gap-2 rounded-lg transition-all ${activeView === 'dashboard' ? 'text-[#6366F1] bg-[#F5F3FF] shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <LayoutDashboard size={14} /> Dashboard Summary
                        </button>
                        <button 
                            onClick={() => setActiveView('plans')}
                            className={`px-5 py-2 text-xs font-bold flex items-center gap-2 rounded-lg transition-all ${activeView === 'plans' ? 'text-[#6366F1] bg-[#F5F3FF] shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Zap size={14} fill={activeView === 'plans' ? "currentColor" : "none"} /> Service Plans
                        </button>
                    </div>
                </div>
            </div>

            {activeView === 'plans' ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0E7FF] flex items-center justify-center">
                                <CheckCircle2 size={14} className="text-[#6366F1]" />
                            </div>
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Available Service Tiers</span>
                        </div>
                        <button 
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-[#8B5CF6] text-white rounded-[14px] hover:bg-[#7C3AED] transition-all font-black text-xs shadow-lg shadow-purple-600/20"
                        >
                            <Plus size={16} /> Create New Plan
                        </button>
                    </div>

                    <div className="bg-white rounded-[32px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-50">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Plan</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pricing</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Validity</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Limitations</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {plans.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200 text-slate-300">
                                                    <Package size={32} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">No Service Plans Yet</p>
                                                    <p className="text-xs font-bold text-slate-400 mt-1">Start by creating your first subscription tier</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    plans.map((plan) => (
                                        <tr key={plan._id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-[#F5F3FF] flex items-center justify-center border border-[#E0E7FF] group-hover:scale-110 transition-transform">
                                                        <Zap size={20} className="text-[#6366F1]" fill={plan.recommended ? "currentColor" : "none"} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-black text-slate-900">{plan.label}</h3>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Code: {plan.name}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="px-3 py-1.5 bg-[#ECFDF5] text-[#059669] rounded-lg text-xs font-black w-fit">
                                                    ₹{plan.price.toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-black w-fit">
                                                    {plan.duration} Days
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-black text-[#6366F1]">{(plan.limits?.contactLimit || 0).toLocaleString()}</span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Users</span>
                                                    </div>
                                                    <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-black text-[#6366F1]">{(plan.limits?.messageLimit || 0).toLocaleString()}</span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Products</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-4">
                                                    <button 
                                                        onClick={() => setEditingPlan(plan)}
                                                        className="text-xs font-black text-slate-400 hover:text-[#6366F1] transition-all uppercase tracking-widest"
                                                    >
                                                        Modify Plan
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeletePlan(plan._id)}
                                                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                        title="Delete Plan"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-[#F5F3FF] flex items-center justify-center border border-[#E0E7FF]">
                                <Users size={24} className="text-[#6366F1]" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Accounts</p>
                                <h3 className="text-3xl font-black text-slate-900">{metrics.activeAccounts}</h3>
                            </div>
                        </div>
                        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-[#FEF2F2] flex items-center justify-center border border-[#FEE2E2]">
                                <ArrowUpRight size={24} className="text-[#EF4444] rotate-45" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expired Plans</p>
                                <h3 className="text-3xl font-black text-slate-900">{metrics.expiredPlans}</h3>
                            </div>
                        </div>
                        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-[#FFF7ED] flex items-center justify-center border border-[#FFEDD5]">
                                <Calendar size={24} className="text-[#F97316]" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiring (7 Days)</p>
                                <h3 className="text-3xl font-black text-slate-900">{metrics.expiringSoon}</h3>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-[240px] relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#6366F1] transition-colors" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search Business or Email...."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 p-3 pl-12 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <select 
                                value={filterTier}
                                onChange={(e) => setFilterTier(e.target.value)}
                                className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-indigo-600"
                            >
                                <option value="ALL">All Service Tiers</option>
                                {plans.map(p => <option key={p._id} value={p.name}>{p.label}</option>)}
                            </select>
                            <select 
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-indigo-600"
                            >
                                <option value="ALL">All Status</option>
                                <option value="ACTIVE">Active</option>
                                <option value="EXPIRED">Expired</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                            <label className={`flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition-all ${filterExpiringSoon ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                                <input 
                                    type="checkbox" 
                                    checked={filterExpiringSoon}
                                    onChange={(e) => setFilterExpiringSoon(e.target.checked)}
                                    className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-600/20" 
                                />
                                <span className="text-xs font-bold">Expiring Soon (7 Days)</span>
                            </label>
                        </div>
                        <div className="h-10 w-px bg-slate-100 mx-2"></div>
                        <button 
                            onClick={() => {
                                setSearchTerm('');
                                setFilterTier('ALL');
                                setFilterStatus('ALL');
                                setFilterExpiringSoon(false);
                            }}
                            className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-all flex items-center gap-2"
                        >
                            <RefreshCw size={14} /> Reset Details
                        </button>
                        <button 
                            onClick={() => setShowAssignModal(true)}
                            className="ml-auto flex items-center gap-2 px-6 py-3 bg-[#8B5CF6] text-white rounded-[14px] hover:bg-[#7C3AED] transition-all font-black text-xs shadow-lg shadow-purple-600/20"
                        >
                            <Plus size={16} /> Assign Assignment
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Status</span>
                                <div className="h-4 w-px bg-slate-200"></div>
                                <div className="flex items-center gap-2">
                                    <DensitySelector
                                        value={rowsPerPage}
                                        onChange={(val) => handleRowsPerPageChange({target: {value: val}})}
                                        options={[
                                            { label: "5 Rows", value: 5 },
                                            { label: "10 Rows", value: 10 },
                                            { label: "20 Rows", value: 20 },
                                            { label: "50 Rows", value: 50 },
                                            { label: "100 Rows", value: 100 }
                                        ]}
                                    />
                                </div>
                                {selectedUserIds.length > 0 && (
                                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2">
                                        <div className="h-4 w-px bg-slate-200"></div>
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                                            {selectedUserIds.length} Selected
                                        </span>
                                        <button 
                                            onClick={() => {
                                                setAssignmentData(prev => ({ ...prev, userId: '' }));
                                                setUserSearchTerm(`${selectedUserIds.length} Users Selected`);
                                                setShowAssignModal(true);
                                            }}
                                            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                                        >
                                            Bulk Assign Plan
                                        </button>
                                        <button 
                                            onClick={() => setSelectedUserIds([])}
                                            className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                )}
                            </div>
                            <span className="px-3 py-1 bg-indigo-50 text-[#6366F1] rounded-full text-[10px] font-black uppercase tracking-widest">{users.length} Records</span>
                        </div>
                        <div className="bg-white rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-50 bg-slate-50/30">
                                        <th className="px-5 py-4 w-10">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedUserIds.length === paginatedUsers.length && paginatedUsers.length > 0}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedUserIds(paginatedUsers.map(u => u._id));
                                                    else setSelectedUserIds([]);
                                                }}
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600/20 cursor-pointer"
                                            />
                                        </th>
                                        <th className="px-2 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Business Account</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Plan</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Operations</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {paginatedUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-8 py-20 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Users size={40} className="text-slate-200" />
                                                    <p className="text-sm font-black text-slate-300 uppercase tracking-widest">No matching accounts found</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedUsers.map((user) => (
                                            <tr key={user._id} className={`hover:bg-slate-50/50 transition-colors group ${selectedUserIds.includes(user._id) ? 'bg-indigo-50/30' : ''}`}>
                                                <td className="px-5 py-3">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedUserIds.includes(user._id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedUserIds(prev => [...prev, user._id]);
                                                            else setSelectedUserIds(prev => prev.filter(id => id !== user._id));
                                                        }}
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600/20 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-2 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:border-indigo-200 group-hover:bg-white transition-all">
                                                            <Users size={16} className="text-slate-400 group-hover:text-indigo-600" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-[13px] font-black text-slate-900 leading-tight">{user.company || user.name}</h3>
                                                            <div className="flex flex-col gap-0 mt-0.5">
                                                                <p className="text-[9px] font-bold text-slate-400 lowercase tracking-tight">{user.email || 'no email'}</p>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                                                    {user.phone ? user.phone : <span className="opacity-40 italic">-</span>}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[11px] font-black text-slate-900">{user.plan || 'No Plan'}</span>
                                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${(user.daysLeft || 0) > 7 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                                {user.daysLeft || 0} Days
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-slate-400">
                                                            <Calendar size={10} />
                                                            <span className="text-[9px] font-bold">{user.subscriptionStartDate ? new Date(user.subscriptionStartDate).toLocaleDateString() : 'N/A'} - {user.accountExpiry ? new Date(user.accountExpiry).toLocaleDateString() : 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${user.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                                        {user.subscriptionStatus || 'INACTIVE'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={() => setViewingUser(user)}
                                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedUserIds([]); // Clear any bulk selection
                                                                setAssignmentData(prev => ({ ...prev, userId: user._id }));
                                                                setUserSearchTerm(user.company || user.name);
                                                                setShowAssignModal(true);
                                                            }}
                                                            className="px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-indigo-600 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-slate-100"
                                                        >
                                                            Assign Plan
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Plan Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[48px] w-full max-w-xl overflow-hidden shadow-2xl p-10 space-y-10 relative">
                        <button onClick={() => setShowCreateModal(false)} className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X size={20} /></button>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-[#1E1B4B] tracking-tight border-b-2 border-[#8B5CF6] w-fit pb-1">Create Subscription Plan</h2>
                            <div className="h-px bg-slate-100 w-full"></div>
                        </div>
                        <form onSubmit={handleCreatePlan} className="space-y-10">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-700 ml-1">Plan Name</label>
                                    <div className="relative group"><Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#8B5CF6] transition-colors" size={18} /><input type="text" placeholder="e.g. Gold" value={newPlan.label} onChange={(e) => setNewPlan({...newPlan, label: e.target.value})} className="w-full bg-white border-2 border-slate-100 p-4 pl-12 rounded-2xl text-sm font-bold focus:border-[#8B5CF6] outline-none transition-all" /></div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-700 ml-1">Plan Code</label>
                                    <div className="relative group"><FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#8B5CF6] transition-colors" size={18} /><input type="text" placeholder="PLAN_GOLD" value={newPlan.name} onChange={(e) => setNewPlan({...newPlan, name: e.target.value.toUpperCase().replace(/\s/g, '_')})} className="w-full bg-white border-2 border-slate-100 p-4 pl-12 rounded-2xl text-sm font-bold focus:border-[#8B5CF6] outline-none transition-all" /></div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-700 ml-1">Price (₹)</label>
                                    <div className="relative group"><div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#8B5CF6] transition-colors font-bold text-lg">₹</div><input type="number" value={newPlan.price} onChange={(e) => setNewPlan({...newPlan, price: Number(e.target.value)})} className="w-full bg-white border-2 border-slate-100 p-4 pl-12 rounded-2xl text-sm font-bold focus:border-[#8B5CF6] outline-none transition-all" /></div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-700 ml-1">Duration (Days)</label>
                                    <div className="relative group"><Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#8B5CF6] transition-colors" size={18} /><input type="number" value={newPlan.duration} onChange={(e) => setNewPlan({...newPlan, duration: Number(e.target.value)})} className="w-full bg-white border-2 border-slate-100 p-4 pl-12 rounded-2xl text-sm font-bold focus:border-[#8B5CF6] outline-none transition-all" /></div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-6 pt-4">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="text-sm font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all">CANCEL</button>
                                <button type="submit" disabled={isUpdating} className="px-10 py-4 bg-[#8B5CF6] text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-purple-600/20 hover:bg-[#7C3AED] transition-all flex items-center gap-2">{isUpdating ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />} Create Plan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Subscription Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[48px] w-full max-w-xl overflow-hidden shadow-2xl p-10 space-y-10 relative">
                        <button onClick={() => {
                            setShowAssignModal(false);
                            setUserSearchTerm('');
                            setShowUserDropdown(false);
                            setAssignmentData({ userId: '', plan: '', expiryDate: '' });
                        }} className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X size={20} /></button>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-[#1E1B4B] tracking-tight border-b-2 border-[#8B5CF6] w-fit pb-1">Assign Subscription</h2>
                            <div className="h-px bg-slate-100 w-full"></div>
                        </div>
                        <form onSubmit={handleAssignPlan} className="space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-2 relative">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Tenant</label>
                                    <div className="relative group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input 
                                            type="text"
                                            placeholder={selectedUserIds.length > 0 ? `${selectedUserIds.length} Users Selected for Bulk Update` : "Search Business / User / Email..."}
                                            value={userSearchTerm}
                                            disabled={selectedUserIds.length > 0}
                                            onChange={(e) => {
                                                setUserSearchTerm(e.target.value);
                                                setShowUserDropdown(true);
                                            }}
                                            onFocus={() => !selectedUserIds.length && setShowUserDropdown(true)}
                                            className={`w-full border-2 p-4 pl-12 rounded-2xl text-sm font-bold outline-none transition-all ${selectedUserIds.length > 0 ? 'bg-indigo-50/50 border-indigo-200 text-indigo-600 cursor-not-allowed' : 'bg-white border-slate-100 focus:border-[#8B5CF6]'}`}
                                        />
                                    </div>
                                    {selectedUserIds.length > 0 && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            <span className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">Bulk Mode</span>
                                        </div>
                                    )}

                                    {/* Smart User Search Results */}
                                    {showUserDropdown && (
                                        <div className="absolute z-[120] left-0 right-0 top-full mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                                            {users.filter(u => 
                                                u.name?.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                                                u.company?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                                u.email?.toLowerCase().includes(userSearchTerm.toLowerCase())
                                            ).map(u => (
                                                <div 
                                                    key={u._id}
                                                    onClick={() => {
                                                        setAssignmentData({...assignmentData, userId: u._id});
                                                        setUserSearchTerm(u.company || u.name);
                                                        setShowUserDropdown(false);
                                                    }}
                                                    className={`p-4 hover:bg-slate-50 cursor-pointer transition-all border-b border-slate-50 flex items-center justify-between ${assignmentData.userId === u._id ? 'bg-indigo-50/50' : ''}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                                            <Users size={16} />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-slate-900">{u.company || u.name}</p>
                                                            <div className="flex gap-2 items-center">
                                                                <p className="text-[9px] font-bold text-slate-400 lowercase tracking-tight">{u.email}</p>
                                                                <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{u.phone || 'No Phone'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {assignmentData.userId === u._id && (
                                                        <CheckCircle2 size={16} className="text-indigo-600" />
                                                    )}
                                                </div>
                                            ))}
                                            {users.filter(u => 
                                                u.name?.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                                                u.company?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                                u.email?.toLowerCase().includes(userSearchTerm.toLowerCase())
                                            ).length === 0 && (
                                                <div className="p-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">No matching tenants</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Plan</label>
                                    <div className="relative group">
                                        <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <select 
                                            value={assignmentData.plan}
                                            onChange={(e) => {
                                                const selected = plans.find(p => p.name === e.target.value);
                                                if (selected) {
                                                    const expiry = new Date();
                                                    expiry.setDate(expiry.getDate() + selected.duration);
                                                    setAssignmentData({...assignmentData, plan: e.target.value, expiryDate: expiry.toISOString().split('T')[0]});
                                                }
                                            }}
                                            className="w-full bg-[#F8F7FF] border-2 border-slate-50 p-4 pl-12 rounded-2xl text-sm font-bold focus:border-[#8B5CF6] outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="">Select Service Tier...</option>
                                            {plans.map(p => <option key={p._id} value={p.name}>{p.label} - ₹{p.price.toLocaleString()} / {p.duration} Days</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Subscription Expiry</label>
                                    <div className="p-6 bg-indigo-50 border-2 border-indigo-100 rounded-[32px] text-center">
                                        <p className="text-sm font-black text-[#6366F1]">
                                            {assignmentData.expiryDate ? new Date(assignmentData.expiryDate).toLocaleDateString(undefined, { dateStyle: 'full' }) : 'Select a plan to calculate'}
                                        </p>
                                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Automatic validity period</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-6 pt-4">
                                <button type="button" onClick={() => {
                                    setShowAssignModal(false);
                                    setSelectedUserIds([]);
                                    setUserSearchTerm('');
                                    setAssignmentData({ userId: '', plan: '', expiryDate: '' });
                                }} className="text-sm font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all">CANCEL</button>
                                <button type="submit" disabled={isUpdating} className={`px-10 py-4 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl transition-all flex items-center gap-2 ${selectedUserIds.length > 0 ? 'bg-indigo-600 shadow-indigo-600/20 hover:bg-indigo-700' : 'bg-[#8B5CF6] shadow-purple-600/20 hover:bg-[#7C3AED]'}`}>
                                    {isUpdating ? <RefreshCw size={16} className="animate-spin" /> : (selectedUserIds.length > 0 ? `Confirm Bulk Assignment (${selectedUserIds.length})` : 'Confirm Assignment')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modify Plan Modal */}
            {editingPlan && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[48px] w-full max-w-xl overflow-hidden shadow-2xl p-10 space-y-10 relative">
                        <button onClick={() => setEditingPlan(null)} className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X size={20} /></button>
                        <div className="space-y-2"><h2 className="text-2xl font-black text-[#1E1B4B] tracking-tight border-b-2 border-[#8B5CF6] w-fit pb-1">Modify Subscription Plan</h2><div className="h-px bg-slate-100 w-full"></div></div>
                        <form onSubmit={handleUpdatePlan} className="space-y-10">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-700 ml-1">Plan Name</label>
                                    <div className="relative group"><Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#8B5CF6] transition-colors" size={18} /><input type="text" value={editingPlan.label} onChange={(e) => setEditingPlan({...editingPlan, label: e.target.value})} className="w-full bg-white border-2 border-slate-100 p-4 pl-12 rounded-2xl text-sm font-bold focus:border-[#8B5CF6] outline-none transition-all" /></div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-700 ml-1">Plan Code</label>
                                    <div className="relative group"><FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#8B5CF6] transition-colors" size={18} /><input type="text" value={editingPlan.name} onChange={(e) => setEditingPlan({...editingPlan, name: e.target.value.toUpperCase().replace(/\s/g, '_')})} className="w-full bg-white border-2 border-slate-100 p-4 pl-12 rounded-2xl text-sm font-bold focus:border-[#8B5CF6] outline-none transition-all" /></div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-700 ml-1">Price (₹)</label>
                                    <div className="relative group"><div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#8B5CF6] transition-colors font-bold text-lg">₹</div><input type="number" value={editingPlan.price} onChange={(e) => setEditingPlan({...editingPlan, price: Number(e.target.value)})} className="w-full bg-white border-2 border-slate-100 p-4 pl-12 rounded-2xl text-sm font-bold focus:border-[#8B5CF6] outline-none transition-all" /></div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-700 ml-1">Duration (Days)</label>
                                    <div className="relative group"><Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#8B5CF6] transition-colors" size={18} /><input type="number" value={editingPlan.duration} onChange={(e) => setEditingPlan({...editingPlan, duration: Number(e.target.value)})} className="w-full bg-white border-2 border-slate-100 p-4 pl-12 rounded-2xl text-sm font-bold focus:border-[#8B5CF6] outline-none transition-all" /></div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-6 pt-4">
                                <button type="button" onClick={() => setEditingPlan(null)} className="text-sm font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all">CANCEL</button>
                                <button type="submit" disabled={isUpdating} className="px-10 py-4 bg-[#8B5CF6] text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-purple-600/20 hover:bg-[#7C3AED] transition-all flex items-center gap-2">{isUpdating ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Update Plan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* View Details Modal */}
            {viewingUser && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-2xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                                    <Users className="text-indigo-600" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">{viewingUser.company || viewingUser.name}</h2>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{viewingUser.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewingUser(null)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><X size={20} /></button>
                        </div>
                        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 bg-slate-50 rounded-3xl space-y-1 border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Plan</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-lg font-black text-indigo-600">{viewingUser.plan || 'No Plan'}</p>
                                        {plans.find(p => p.name === viewingUser.plan) && (
                                            <div className="px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[9px] font-black uppercase">
                                                ₹{plans.find(p => p.name === viewingUser.plan)?.price.toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-3xl space-y-1 border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                                    <p className={`text-lg font-black ${viewingUser.subscriptionStatus === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {viewingUser.subscriptionStatus || 'INACTIVE'}
                                    </p>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-3xl space-y-1 border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</p>
                                    <p className="font-bold text-slate-700">{viewingUser.subscriptionStartDate ? new Date(viewingUser.subscriptionStartDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}</p>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-3xl space-y-1 border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiry Date</p>
                                    <p className="font-bold text-slate-700">{viewingUser.accountExpiry ? new Date(viewingUser.accountExpiry).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setViewingUser(null)} className="px-8 py-3 bg-slate-900 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-slate-900/10 transition-all">Close Details</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Upload Proof Modal Removed as requested */}
        </div>
    );
};

export default MasterPlans;
