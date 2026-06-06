import React, { useState, useEffect } from 'react';
import {
    Users,
    Search,
    MoreVertical,
    ExternalLink,
    Ban,
    CheckCircle2,
    Trash2,
    Eye,
    Filter,
    ShoppingCart,
    Activity,
    UserCheck,
    Key,
    LogOut,
    RefreshCw,
    X,
    Lock,
    MessageSquare,
    AlertCircle,
    Shield,
    Calendar,
    Mail,
    Crown,
    UserX,
    UserPlus,
    Settings,
    TrendingUp,
    Clock,
    Wifi,
    WifiOff,
    ToggleLeft,
    ToggleRight,
    Layout,
    Globe,
    ShoppingBag,
    Layers,
    Zap,
    Bot,
    Minus,
    PlusCircle,
    Server,
    Terminal,
    Smartphone,
    GitBranch
} from 'lucide-react';
import api from '../../api/api';
import DensitySelector from '../../components/UI/DensitySelector';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all'); // 'all', 'active', 'inactive', 'temp_blocked', 'permanent_blocked'
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedUserDetails, setSelectedUserDetails] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [newTenant, setNewTenant] = useState({ name: '', email: '', phoneNumber: '', password: '' });
    const [selectedPlan, setSelectedPlan] = useState('');
    const [planExpiry, setPlanExpiry] = useState('');
    const [updatingPassword, setUpdatingPassword] = useState(false);
    const [creatingTenant, setCreatingTenant] = useState(false);
    const [updatingPlan, setUpdatingPlan] = useState(false);
    const [showControlModal, setShowControlModal] = useState(false);
    const [selectedControlUser, setSelectedControlUser] = useState(null);
    const [updatingControl, setUpdatingControl] = useState(false);
    const [actionLoading, setActionLoading] = useState({});
    const [availablePlans, setAvailablePlans] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(parseInt(localStorage.getItem('superadmin_users_density')) || 10);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await api.get('/superadmin/users');
            console.log('🔍 [FRONTEND] Users API response:', res.data);

            // Extract users from simplified response.data.data
            if (res.data.success && Array.isArray(res.data.data)) {
                const usersData = res.data.data;
                console.log('✅ [FRONTEND] Users fetched successfully:', usersData.length);
                setUsers(usersData);
            } else {
                console.error('❌ [FRONTEND] Unexpected API response format:', res.data);
                setUsers([]);
            }
        } catch (err) {
            console.error('❌ [FRONTEND] Failed to fetch users', err);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailablePlans = async () => {
        try {
            const res = await api.get('/superadmin/plans');
            if (res.data.success) {
                setAvailablePlans(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch available plans:', err);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchAvailablePlans();
    }, []);

    const toggleStatus = async (userId, currentStatus) => {
        try {
            setActionLoading(prev => ({ ...prev, [userId]: 'status' }));
            const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

            const res = await api.patch(`/superadmin/users/${userId}/status`, { status: nextStatus });
            if (res.data.success) {
                setUsers(prevUsers =>
                    Array.isArray(prevUsers)
                        ? prevUsers.map(u => u._id === userId ? { ...u, status: nextStatus } : u)
                        : []
                );
                showToast(`User set to ${nextStatus.toLowerCase()}`, 'success');
            }
        } catch (err) {
            showToast('Failed to update status', 'error');
            fetchUsers();
        } finally {
            setActionLoading(prev => ({ ...prev, [userId]: null }));
        }
    };

    const handleCreateTenant = async (e) => {
        e.preventDefault();
        try {
            setCreatingTenant(true);
            const res = await api.post('/superadmin/users/create', newTenant);
            if (res.data.success) {
                setUsers(prevUsers => Array.isArray(prevUsers) ? [res.data.data, ...prevUsers] : [res.data.data]);
                setShowCreateModal(false);
                setNewTenant({ name: '', email: '', phoneNumber: '', password: '' });
                alert("Tenant created successfully");
            }
        } catch (err) {
            alert(err.response?.data?.error || "Failed to create tenant");
        } finally {
            setCreatingTenant(false);
        }
    };

    const resetPassword = async (userId, newPassword) => {
        try {
            console.log('🔐 [FRONTEND] Resetting password for user:', userId);
            const res = await api.post(`/superadmin/reset-password/${userId}`, { password: newPassword });
            if (res.data.success) {
                console.log('✅ [FRONTEND] Password reset successfully');
                const generatedPassword = res.data.data.newPassword;
                setShowPasswordModal(false);
                setNewPassword('');
                setSelectedUser(null);
                // Show success message
                alert(`Password reset successfully!\n\nNew Password: ${generatedPassword}\n\nPlease save this password securely.`);
            } else {
                console.error('❌ [FRONTEND] Password reset failed:', res.data);
                alert(res.data.error || 'Failed to reset password');
            }
        } catch (err) {
            console.error('❌ [FRONTEND] Password reset error:', err);
            alert(err.response?.data?.error || 'Failed to reset password');
        }
    };

    const viewUserDetails = async (userId) => {
        try {
            console.log('👁 [FRONTEND] Fetching user details:', userId);
            const res = await api.get(`/superadmin/users/${userId}`);
            if (res.data.success) {
                console.log('✅ [FRONTEND] User details fetched:', res.data.data);
                setSelectedUserDetails(res.data.data);
                setShowUserModal(true);
            } else {
                console.error('❌ [FRONTEND] Failed to fetch user details:', res.data);
                showToast(res.data.error || 'Failed to fetch user details', 'error');
            }
        } catch (err) {
            console.error('❌ [FRONTEND] Error fetching user details:', err);
            showToast(err.response?.data?.error || 'Failed to fetch user details', 'error');
        }
    };

    const handlePasswordReset = async () => {
        if (!newPassword || newPassword.length < 6) return showToast("Password must be at least 6 characters", 'error');
        await resetPassword(selectedUser, newPassword);
    };

    const toggleBlock = async (userId, isCurrentlyBlocked) => {
        try {
            const nextBlocked = !isCurrentlyBlocked;
            const res = await api.post(`/superadmin/block/${userId}`, {
                blocked: nextBlocked,
                blockType: 'PERMANENT',
                blockReason: nextBlocked ? 'Blocked by Master Admin' : null
            });

            if (res.data.success) {
                setUsers(prevUsers =>
                    Array.isArray(prevUsers)
                        ? prevUsers.map(u => u._id === userId ? { ...u, status: nextBlocked ? 'PERMANENT_BLOCKED' : 'ACTIVE' } : u)
                        : []
                );
                showToast(`User ${nextBlocked ? 'blocked' : 'unblocked'} successfully`, 'success');
                fetchUsers();
            }
        } catch (err) {
            showToast('Block action failed', 'error');
        }
    };


    // Toast notification helper
    const showToast = (message, type = 'info') => {
        // Simple toast implementation - you can replace with your preferred toast library
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white font-medium z-50 animate-in fade-in slide-in-from-right duration-300 ${type === 'success' ? 'bg-blue-600' :
            type === 'error' ? 'bg-red-600' :
                'bg-blue-600'
            }`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('animate-out', 'fade-out', 'slide-out-to-right');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    };

    const forceLogoutUser = async (userId) => {
        try {
            setActionLoading(prev => ({ ...prev, [userId]: 'logout' }));
            console.log(`🚪 [FRONTEND] Force logging out user: ${userId}`);
            const res = await api.post(`/superadmin/users/${userId}/impersonate`); // reusing impersonate logic if needed, or matching route

            if (res.data.success) {
                console.log('✅ [FRONTEND] User force logged out successfully');
                showToast('User force logged out successfully', 'success');
            } else {
                console.error('❌ [FRONTEND] Force logout failed:', res.data);
                showToast(res.data.error || 'Failed to force logout user', 'error');
            }
        } catch (err) {
            console.error('❌ [FRONTEND] Force logout error:', err);
            showToast(err.response?.data?.error || 'Failed to force logout user', 'error');
        } finally {
            setActionLoading(prev => ({ ...prev, [userId]: null }));
        }
    };

    const handleImpersonate = async (userId) => {
        try {
            if (!window.confirm("Are you sure you want to impersonate this user? You will be logged in as them.")) return;

            console.log(`🎭 [FRONTEND] Impersonating user: ${userId}`);
            const res = await api.post(`/superadmin/users/${userId}/impersonate`);

            if (res.data.success) {
                // Clear current storage but keep super admin token if we wanted 'switch back' feature (advanced). 
                // For now, simple switch:
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data.user));

                showToast('Impersonation successful! Redirecting...', 'success');

                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            } else {
                showToast(res.data.error || 'Impersonation failed', 'error');
            }
        } catch (err) {
            console.error('❌ [FRONTEND] Impersonation error:', err);
            showToast(err.response?.data?.error || 'Impersonation failed', 'error');
        }
    };

    const updateUserPlan = async () => {
        try {
            setUpdatingPlan(true);
            console.log(`📋 [FRONTEND] Updating user plan: ${selectedUser._id} to ${selectedPlan}`);

            const res = await api.patch(`/superadmin/users/${selectedUser._id}/plan`, {
                plan: selectedPlan,
                expiryDate: planExpiry
            });

            if (res.data.success) {
                console.log('✅ [FRONTEND] User plan updated successfully');
                setUsers(prevUsers =>
                    Array.isArray(prevUsers)
                        ? prevUsers.map(u => u._id === selectedUser._id ? { ...u, plan: selectedPlan, accountExpiry: planExpiry } : u)
                        : []
                );
                setShowPlanModal(false);
                setSelectedPlan('');
                setPlanExpiry('');
                setSelectedUser(null);
                showToast('User plan updated successfully', 'success');
            } else {
                console.error('❌ [FRONTEND] Plan update failed:', res.data);
                showToast(res.data.error || 'Failed to update user plan', 'error');
            }
        } catch (err) {
            console.error('❌ [FRONTEND] Plan update error:', err);
            showToast(err.response?.data?.error || 'Failed to update user plan', 'error');
        } finally {
            setUpdatingPlan(false);
        }
    };

    const openPlanModal = (user) => {
        setSelectedUser(user);
        setSelectedPlan(user.plan || 'basic');
        setPlanExpiry(user.accountExpiry ? new Date(user.accountExpiry).toISOString().split('T')[0] : '');
        setShowPlanModal(true);
    };

    const openControlModal = (user) => {
        // Enforce fresh data
        const freshUser = users.find(u => u._id === user._id) || user;
        setSelectedControlUser(JSON.parse(JSON.stringify(freshUser)));
        setShowControlModal(true);
    };

    const handleUpdatePermissions = async (userId, permissions) => {
        try {
            setUpdatingControl(true);
            const res = await api.patch(`/superadmin/users/${userId}/permissions`, { permissions });
            if (res.data.success) {
                setUsers(prev => prev.map(u => u._id === userId ? { ...u, permissions } : u));
                showToast('Permissions updated successfully', 'success');
            }
        } catch (err) {
            showToast('Failed to update permissions', 'error');
        } finally {
            setUpdatingControl(false);
        }
    };

    const handleUpdateIntegrations = async (userId, data) => {
        try {
            setUpdatingControl(true);
            const res = await api.patch(`/superadmin/users/${userId}/integrations`, data);
            if (res.data.success) {
                setUsers(prev => prev.map(u => u._id === userId ? { ...u, ...data } : u));
                showToast('Integration access updated', 'success');
            }
        } catch (err) {
            showToast('Failed to update integrations', 'error');
        } finally {
            setUpdatingControl(false);
        }
    };

    const handleUpdateTrial = async (userId, trial) => {
        try {
            setUpdatingControl(true);
            const res = await api.patch(`/superadmin/users/${userId}/trial`, { trial });
            if (res.data.success) {
                setUsers(prev => prev.map(u => u._id === userId ? { ...u, trial } : u));
                showToast('Trial configuration updated', 'success');
            }
        } catch (err) {
            showToast('Failed to update trial', 'error');
        } finally {
            setUpdatingControl(false);
        }
    };

    const handleUpdateLimits = async (userId, limits) => {
        try {
            setUpdatingControl(true);
            const res = await api.patch(`/superadmin/users/${userId}/limits`, { limits });
            if (res.data.success) {
                setUsers(prev => prev.map(u => u._id === userId ? { ...u, limits } : u));
                showToast('Usage limits updated', 'success');
            }
        } catch (err) {
            showToast('Failed to update limits', 'error');
        } finally {
            setUpdatingControl(false);
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            'ACTIVE': { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2, text: 'Active' },
            'INACTIVE': { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: X, text: 'Inactive' },
            'TEMP_BLOCKED': { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock, text: 'Temp Blocked' },
            'PERMANENT_BLOCKED': { color: 'bg-red-100 text-red-700 border-red-200', icon: Ban, text: 'Permanent Blocked' }
        };

        const badge = badges[status] || badges['INACTIVE'];
        const Icon = badge.icon;

        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.color}`}>
                <Icon size={12} />
                {badge.text}
            </span>
        );
    };

    const getPlanBadge = (plan) => {
        const plans = {
            'basic': { color: 'bg-slate-100 text-slate-700', icon: Users, text: 'Basic' },
            'pro': { color: 'bg-blue-100 text-blue-700', icon: TrendingUp, text: 'Pro' },
            'enterprise': { color: 'bg-purple-100 text-purple-700', icon: Crown, text: 'Enterprise' }
        };

        const planBadge = plans[plan] || plans['basic'];
        const Icon = planBadge.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold ${planBadge.color}`}>
                <Icon size={10} />
                {planBadge.text}
            </span>
        );
    };


    const filteredUsers = Array.isArray(users) ? users.filter(u => {
        const matchesSearch = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.company?.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesStatus = true;
        if (filter === 'active') {
            matchesStatus = u.status === 'ACTIVE';
        } else if (filter === 'inactive') {
            matchesStatus = u.status === 'INACTIVE';
        } else if (filter === 'temp_blocked') {
            matchesStatus = u.status === 'TEMP_BLOCKED';
        } else if (filter === 'permanent_blocked') {
            matchesStatus = u.status === 'PERMANENT_BLOCKED';
        }

        return matchesSearch && matchesStatus;
    }) : [];

    const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const handleRowsPerPageChange = (e) => {
        const value = parseInt(e.target.value);
        setRowsPerPage(value);
        setCurrentPage(1);
        localStorage.setItem('superadmin_users_density', value);
    };

    console.log('Total users:', users.length);
    console.log('Filter:', filter);
    console.log('Filtered users:', filteredUsers.length);
    console.log('Search term:', searchTerm);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-32">
                <RefreshCw className="text-indigo-600 mb-4" size={40} />
                <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Accessing User Directory...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                <div>
                    <h1 className="text-[22px] font-bold text-slate-900 leading-snug">User Management</h1>
                    <p className="text-sm font-normal text-slate-500 mt-1">Manage platform users and access controls</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-900 pl-14 pr-6 py-4 rounded-[20px] w-full md:w-96 outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all font-semibold shadow-[0px_4px_12px_rgba(0,0,0,0.05)]"
                        />
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-[20px] hover:bg-indigo-700 transition-all font-black text-sm shadow-lg shadow-indigo-600/20 uppercase tracking-widest"
                    >
                        <Users size={18} /> Add Tenant
                    </button>
                    <button onClick={fetchUsers} className="p-4 bg-white border border-slate-200 rounded-[20px] text-slate-500 hover:text-indigo-600 hover:border-indigo-600 transition-all shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 bg-slate-50/50 p-1 rounded-lg w-fit border border-slate-200">
                    <button
                        onClick={() => { setFilter('all'); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-widest transition-all ${filter === 'all'
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                    >
                        All Users
                    </button>
                    <div className="w-px h-3 bg-slate-200"></div>
                    <button
                        onClick={() => { setFilter('active'); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-widest transition-all ${filter === 'active'
                            ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                            }`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => { setFilter('inactive'); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-widest transition-all ${filter === 'inactive'
                            ? 'bg-white text-slate-700 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                    >
                        Inactive
                    </button>
                    <button
                        onClick={() => { setFilter('temp_blocked'); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-widest transition-all ${filter === 'temp_blocked'
                            ? 'bg-white text-amber-700 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                            }`}
                    >
                        Temp Blocked
                    </button>
                    <button
                        onClick={() => { setFilter('permanent_blocked'); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-widest transition-all ${filter === 'permanent_blocked'
                            ? 'bg-white text-rose-700 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                    >
                        Banned
                    </button>
                </div>

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
            </div>

            {/* Table Card */}
            <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tenant Details</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contact Number</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Plan Validity</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Integrations</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Access Status</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedUsers.map((user) => (
                            <tr key={user._id} className="hover:bg-slate-50/30 transition-colors group">
                                <td className="px-6 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100 font-bold text-indigo-600 text-[12px] group-hover:bg-white transition-all">
                                            {user.name?.[0]?.toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-800 text-[13px] leading-tight">{user.company || user.name}</div>
                                            <div className="font-bold text-slate-400 text-[10px] mt-0.5 lowercase tracking-tight">{user.email}</div>
                                            <div className="font-bold text-slate-300 text-[9px] mt-0.5 uppercase tracking-widest">ID_{user._id.slice(-6).toUpperCase()}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <div className="flex flex-col items-start gap-0.5">
                                        <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700">
                                            <Smartphone size={12} className="text-slate-400" />
                                            {user.phoneNumber || <span className="opacity-40 italic">No Number</span>}
                                        </div>
                                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight ml-4.5">VERIFIED: {user.phoneVerified ? 'YES' : 'NO'}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded-md uppercase">{user.plan || 'FREE'}</span>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${(user.daysLeft || 0) > 5 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                {user.daysLeft || 0} Days
                                            </span>
                                        </div>
                                        <div className="font-bold text-slate-400 text-[9px] uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                            <Calendar size={10} />
                                            {user.accountExpiry ? new Date(user.accountExpiry).toLocaleDateString('en-GB') : 'N/A'}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <div className="flex gap-1.5">
                                        {[
                                            { icon: MessageSquare, active: user.hasWhatsApp, color: 'text-blue-600', bg: 'bg-blue-50' },
                                            { icon: ShoppingBag, active: user.hasWhatsAppCommerce, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                            { icon: ShoppingCart, active: user.hasWooCommerce, color: 'text-orange-600', bg: 'bg-orange-50' },
                                            { icon: Globe, active: user.hasShopify, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                            { icon: Bot, active: user.hasAiBot, color: 'text-purple-600', bg: 'bg-purple-50' },
                                            { icon: Smartphone, active: user.hasFacebookInstagram, color: 'text-pink-600', bg: 'bg-pink-50' }
                                        ].map((int, i) => (
                                            <div key={i} className={`p-1.5 rounded-md border transition-all ${int.active ? `${int.bg} border-indigo-100 ${int.color}` : 'bg-slate-50 border-slate-100 text-slate-200'}`}>
                                                <int.icon size={12} />
                                            </div>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <div className="flex flex-col gap-1">
                                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full w-fit text-[9px] font-black uppercase tracking-widest border transition-all ${user.status === 'TEMP_BLOCKED'
                                            ? 'bg-amber-50 border-amber-100 text-amber-700'
                                            : user.status === 'PERMANENT_BLOCKED'
                                                ? 'bg-rose-50 border-rose-100 text-rose-700'
                                                : user.status === 'ACTIVE'
                                                    ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                                                    : 'bg-slate-50 border-slate-200 text-slate-600'
                                            }`}>
                                            <div className={`w-1 h-1 rounded-full ${user.status === 'TEMP_BLOCKED' ? 'bg-amber-500' : user.status === 'PERMANENT_BLOCKED' ? 'bg-rose-500' : user.status === 'ACTIVE' ? 'bg-indigo-500' : 'bg-slate-500'}`}></div>
                                            {user.status === 'TEMP_BLOCKED' ? 'Temp Blocked' : user.status === 'PERMANENT_BLOCKED' ? 'Banned' : user.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <button
                                            onClick={() => toggleStatus(user._id, user.status)}
                                            className={`p-1.5 rounded-md transition-all ${user.status === 'ACTIVE' ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                            title={user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                        >
                                            {user.status === 'ACTIVE' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                        </button>
                                        <button
                                            onClick={() => toggleBlock(user._id, user.status === 'PERMANENT_BLOCKED' || user.status === 'TEMP_BLOCKED')}
                                            className={`p-1.5 rounded-md transition-all ${user.status === 'PERMANENT_BLOCKED' || user.status === 'TEMP_BLOCKED' ? 'text-rose-600 bg-rose-50 hover:bg-rose-100' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                                            title="Block/Unblock"
                                        >
                                            <Ban size={14} />
                                        </button>
                                        <button
                                            onClick={() => { setSelectedUser(user._id); setShowPasswordModal(true); }}
                                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                            title="Reset Password"
                                        >
                                            <Key size={14} />
                                        </button>
                                        <button
                                            onClick={() => openControlModal(user)}
                                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                            title="Governance"
                                        >
                                            <Shield size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleImpersonate(user._id)}
                                            className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                                            title="Login"
                                        >
                                            <LogOut size={14} className="rotate-180" />
                                        </button>
                                        <button
                                            onClick={() => viewUserDetails(user._id)}
                                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                            title="View Details"
                                        >
                                            <Eye size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="px-6 py-3 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredUsers.length)} of {filteredUsers.length} Tenants
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-all shadow-sm"
                            >
                                <Minus size={14} />
                            </button>
                            <div className="flex items-center gap-1">
                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`w-7 h-7 rounded-md text-[10px] font-black transition-all ${currentPage === i + 1 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-600 hover:text-indigo-600'}`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-all shadow-sm"
                            >
                                <PlusCircle size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 rounded-[12px]">
                                    <Lock className="text-indigo-600" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">Reset Access</h2>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Master Override</p>
                                </div>
                            </div>
                            <button onClick={() => setShowPasswordModal(false)} className="p-2 hover:bg-slate-100 rounded-[12px] transition-all">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">New Root Password</label>
                                <div className="relative">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Enter new strong password..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-[12px] pl-12 pr-4 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                </div>
                                <p className="mt-3 text-[10px] text-slate-400 font-bold leading-relaxed">Admin reset will immediately invalidate the user's current session upon their next request.</p>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowPasswordModal(false)}
                                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-[12px] text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePasswordReset}
                                    disabled={updatingPassword}
                                    className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-[12px] text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50"
                                >
                                    {updatingPassword ? 'Reseting...' : 'Confirm Reset'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Plan Modal */}
            {showPlanModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-purple-50 rounded-[12px]">
                                    <Crown className="text-purple-600" size={24} />
                                </div>
                                <h2 className="text-xl font-black text-slate-900">Subscription Tier</h2>
                            </div>
                            <button onClick={() => setShowPlanModal(false)} className="p-2 hover:bg-slate-100 rounded-[12px] transition-all">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Plan</label>
                                <select
                                    value={selectedPlan}
                                    onChange={(e) => setSelectedPlan(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-[12px] px-4 py-3 font-semibold focus:ring-4 focus:ring-purple-600/5 focus:border-purple-600 outline-none transition-all"
                                >
                                    {availablePlans.map(p => (
                                        <option key={p._id} value={p.name}>{p.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Expiry Date (Optional)</label>
                                <input
                                    type="date"
                                    value={planExpiry}
                                    onChange={(e) => setPlanExpiry(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-[12px] px-4 py-3 font-semibold focus:ring-4 focus:ring-purple-600/5 focus:border-purple-600 outline-none transition-all"
                                />
                            </div>

                            <button
                                onClick={updateUserPlan}
                                disabled={updatingPlan}
                                className="w-full py-4 bg-purple-600 text-white font-black rounded-[12px] text-xs uppercase tracking-widest shadow-lg shadow-purple-600/20 hover:bg-purple-700 transition-all disabled:opacity-50"
                            >
                                {updatingPlan ? 'Updating...' : 'Update Subscription'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Tenant Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 rounded-[12px]">
                                    <Users className="text-blue-600" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">Provision Tenant</h2>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Master Deployment</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-[12px] transition-all">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTenant} className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Company / Owner Name</label>
                                    <input
                                        type="text"
                                        placeholder="Tenant identifier..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-[12px] px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                                        value={newTenant.name}
                                        onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Primary Email</label>
                                    <input
                                        type="email"
                                        placeholder="Business email..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-[12px] px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                                        value={newTenant.email}
                                        onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Contact Number</label>
                                    <div className="relative">
                                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Mobile number..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-[12px] pl-12 pr-4 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                                            value={newTenant.phoneNumber}
                                            onChange={(e) => setNewTenant({ ...newTenant, phoneNumber: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Initial Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="password"
                                            placeholder="Secure passphrase..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-[12px] pl-12 pr-4 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                                            value={newTenant.password}
                                            onChange={(e) => setNewTenant({ ...newTenant, password: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={creatingTenant}
                                className="w-full py-5 bg-blue-600 text-white font-black rounded-[12px] text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {creatingTenant ? <RefreshCw size={18} /> : <CheckCircle2 size={18} />}
                                {creatingTenant ? 'Spinning up Tenant...' : 'Initialize Tenant'}
                            </button>
                        </form>
                    </div>
                </div>
            )}


            {/* User Details Modal */}
            {showUserModal && selectedUserDetails && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-bold text-slate-900">User Details</h2>
                            <button
                                onClick={() => { setShowUserModal(false); setSelectedUserDetails(null); }}
                                className="p-3 rounded-[12px] bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* User Profile */}
                            <div className="flex items-center gap-6 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-[12px]">
                                <div className="w-20 h-20 bg-indigo-600 text-white rounded-[12px] flex items-center justify-center text-2xl font-bold shadow-lg">
                                    {selectedUserDetails.name?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">{selectedUserDetails.name}</h3>
                                    <p className="text-slate-600 font-medium">{selectedUserDetails.email}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${selectedUserDetails.status === 'TEMP_BLOCKED'
                                            ? 'bg-amber-100 text-amber-700'
                                            : selectedUserDetails.status === 'PERMANENT_BLOCKED'
                                                ? 'bg-rose-100 text-rose-700'
                                                : selectedUserDetails.status === 'ACTIVE'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-slate-100 text-slate-700'
                                            }`}>
                                            {selectedUserDetails.status}
                                        </span>
                                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-widest">
                                            {selectedUserDetails.plan || 'FREE'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* User Information Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-50 rounded-[12px] p-6">
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Account Information</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">User ID</p>
                                            <p className="text-sm font-bold text-slate-900">{selectedUserDetails._id}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">Role</p>
                                            <p className="text-sm font-bold text-slate-900">{selectedUserDetails.role}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">Created</p>
                                            <p className="text-sm font-bold text-slate-900">{new Date(selectedUserDetails.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-[12px] p-6">
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Status & Access</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">Account Status</p>
                                            <p className="text-sm font-bold text-slate-900">{selectedUserDetails.status}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">Blocked</p>
                                            <p className="text-sm font-bold text-slate-900">{selectedUserDetails.blocked ? 'Yes' : 'No'}</p>
                                        </div>
                                        {selectedUserDetails.blockUntil && (
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">Block Until</p>
                                                <p className="text-sm font-bold text-slate-900">{new Date(selectedUserDetails.blockUntil).toLocaleDateString()}</p>
                                            </div>
                                        )}
                                        {selectedUserDetails.blockReason && (
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">Block Reason</p>
                                                <p className="text-sm font-bold text-slate-900">{selectedUserDetails.blockReason}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Last Login */}
                            {selectedUserDetails.lastLogin && (
                                <div className="bg-blue-50 rounded-[12px] p-6">
                                    <h4 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-2">Last Login</h4>
                                    <p className="text-sm font-bold text-blue-900">{new Date(selectedUserDetails.lastLogin).toLocaleString()}</p>
                                </div>
                            )}

                            {/* Activity Logs (Admin/System Actions) */}
                            {selectedUserDetails.recentLogs && selectedUserDetails.recentLogs.length > 0 && (
                                <div className="bg-slate-50 rounded-[12px] p-6">
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Recent Account Activity</h4>
                                    <div className="space-y-3">
                                        {selectedUserDetails.recentLogs.map((log, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-[12px] border border-slate-200">
                                                <div className="p-2 bg-indigo-50 rounded-lg">
                                                    <Activity size={14} className="text-indigo-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">{log.action}</p>
                                                    <p className="text-[10px] text-slate-500 mt-1">{log.details}</p>
                                                    <p className="text-[10px] text-slate-400 mt-1">{new Date(log.createdAt).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* 🔥 SUPER ADMIN CONTROL PANEL MODAL */}
            {showControlModal && selectedControlUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[40px] w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">

                        {/* Modal Header */}
                        <div className="bg-slate-900 px-8 py-8 flex items-center justify-between text-white shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-blue-500/20 rounded-[24px] border border-blue-500/30">
                                    <Shield className="text-blue-400" size={32} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight leading-none">Security & Governance</h2>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">Master Access Level 5</span>
                                        <div className="w-1 h-1 rounded-full bg-slate-600"></div>
                                        <span className="text-slate-400 text-xs font-semibold">{selectedControlUser.email}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowControlModal(false); setSelectedControlUser(null); }}
                                className="p-3 bg-white/10 hover:bg-white/20 rounded-[12px] transition-all border border-white/10"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                                {/* 1. Permission Controls */}
                                <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2.5 bg-indigo-50 rounded-[12px]">
                                            <Lock className="text-indigo-600" size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 leading-none">Access Permissions</h3>
                                            <p className="text-xs text-slate-400 font-medium mt-1">Control modular visibility</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {Object.entries({
                                            dashboard: true, contacts: true, appointments: true, templates: true, campaigns: true,
                                            automation: true, whatsappFlows: true, analytics: true, integrations: true, settings: true, aiTools: false,
                                            ...(selectedControlUser.permissions || {})
                                        }).map(([key, value]) => (
                                            <div key={key} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-[12px] border border-slate-200 hover:border-indigo-200 transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <div className="text-slate-500 group-hover:text-indigo-600 transition-colors">
                                                        {key === 'dashboard' && <Layout size={16} />}
                                                        {key === 'contacts' && <Users size={16} />}
                                                        {key === 'appointments' && <Calendar size={16} />}
                                                        {key === 'templates' && <Layers size={16} />}
                                                        {key === 'campaigns' && <Zap size={16} />}
                                                        {key === 'automation' && <GitBranch size={16} />}
                                                        {key === 'whatsappFlows' && <Bot size={16} />}
                                                        {key === 'analytics' && <TrendingUp size={16} />}
                                                        {key === 'integrations' && <Globe size={16} />}
                                                        {key === 'settings' && <Settings size={16} />}
                                                        {key === 'aiTools' && <Bot size={16} />}
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-700 capitalize">{key === 'automation' ? 'Flow Builder' : key === 'whatsappFlows' ? 'WhatsApp Flows' : key.replace(/([A-Z])/g, ' $1')}</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const newPerms = { ...selectedControlUser.permissions, [key]: !value };
                                                        handleUpdatePermissions(selectedControlUser._id, newPerms);
                                                        setSelectedControlUser({ ...selectedControlUser, permissions: newPerms });
                                                    }}
                                                    className={`w-12 h-6 rounded-full p-1 transition-all ${value ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                                >
                                                    <div className={`w-4 h-4 bg-white rounded-full transition-all ${value ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 2. Advanced Integration Control */}
                                <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2.5 bg-orange-50 rounded-[12px]">
                                            <Globe className="text-orange-600" size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 leading-none">Integration Access & Expiry</h3>
                                            <p className="text-xs text-slate-400 font-medium mt-1">SaaS integration permissions</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {[
                                            { key: 'woocommerce', label: 'WooCommerce', icon: ShoppingCart },
                                            { key: 'shopify', label: 'Shopify', icon: TrendingUp },
                                            { key: 'whatsapp', label: 'WhatsApp API', icon: MessageSquare },
                                            { key: 'whatsapp_commerce', label: 'WhatsApp Commerce', icon: ShoppingBag },
                                            { key: 'facebook_instagram', label: 'Facebook & Instagram', icon: Smartphone },
                                            { key: 'ai_bot', label: 'AI Integration', icon: Bot }
                                        ].map((item) => {
                                            const config = selectedControlUser.integrations?.[item.key] || { enabled: false, expiryDate: null };
                                            const Icon = item.icon;

                                            return (
                                                <div key={item.key} className="p-5 bg-slate-50/50 rounded-[20px] border border-slate-200 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm text-orange-500">
                                                                <Icon size={18} />
                                                            </div>
                                                            <span className="text-sm font-black text-slate-900">{item.label}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const newIntegrations = {
                                                                    ...(selectedControlUser.integrations || {}),
                                                                    [item.key]: { ...config, enabled: !config.enabled }
                                                                };
                                                                handleUpdateIntegrations(selectedControlUser._id, { integrations: newIntegrations });
                                                                setSelectedControlUser({ ...selectedControlUser, integrations: newIntegrations });
                                                            }}
                                                            className={`w-12 h-6 rounded-full p-1 transition-all ${config.enabled ? 'bg-orange-500' : 'bg-slate-300'}`}
                                                        >
                                                            <div className={`w-4 h-4 bg-white rounded-full transition-all ${config.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 3. Trial & Subscription Control */}
                                <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2.5 bg-purple-50 rounded-[12px]">
                                            <Clock className="text-purple-600" size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 leading-none">Trial Management</h3>
                                            <p className="text-xs text-slate-400 font-medium mt-1">Lifecycle and overrides</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between p-5 bg-purple-50/50 border border-purple-100 rounded-[12px]">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-purple-700 uppercase tracking-widest">Trial Status</span>
                                                <span className="text-sm font-bold mt-1">
                                                    {selectedControlUser.trial?.isActive ? 'ACTIVE' : 'EXPIRED'}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const newTrial = { ...selectedControlUser.trial, isActive: !selectedControlUser.trial?.isActive };
                                                    handleUpdateTrial(selectedControlUser._id, newTrial);
                                                    setSelectedControlUser({ ...selectedControlUser, trial: newTrial });
                                                }}
                                                className={`px-4 py-2 rounded-[12px] text-[10px] font-black uppercase tracking-widest transition-all ${selectedControlUser.trial?.isActive ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}
                                            >
                                                {selectedControlUser.trial?.isActive ? 'End Trial Early' : 'Restore Trial'}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trial Start</label>
                                                <input
                                                    type="date"
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-[12px] px-4 py-3 text-sm font-bold focus:border-purple-600 outline-none"
                                                    value={selectedControlUser.trial?.startDate ? new Date(selectedControlUser.trial.startDate).toISOString().split('T')[0] : ''}
                                                    onChange={(e) => {
                                                        const newTrial = { ...selectedControlUser.trial, startDate: e.target.value };
                                                        handleUpdateTrial(selectedControlUser._id, newTrial);
                                                        setSelectedControlUser({ ...selectedControlUser, trial: newTrial });
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trial Expiry</label>
                                                <input
                                                    type="date"
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-[12px] px-4 py-3 text-sm font-bold focus:border-purple-600 outline-none"
                                                    value={selectedControlUser.trial?.endDate ? new Date(selectedControlUser.trial.endDate).toISOString().split('T')[0] : ''}
                                                    onChange={(e) => {
                                                        const newTrial = { ...selectedControlUser.trial, endDate: e.target.value };
                                                        handleUpdateTrial(selectedControlUser._id, newTrial);
                                                        setSelectedControlUser({ ...selectedControlUser, trial: newTrial });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 4. Usage Limits Override */}
                                <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2.5 bg-blue-50 rounded-[12px]">
                                            <TrendingUp className="text-blue-600" size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 leading-none">Hard Usage Limits</h3>
                                            <p className="text-xs text-slate-400 font-medium mt-1">Manual quotas override package</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                                        {[
                                            { key: 'templateLimit', usageKey: 'templatesCreated', label: 'Templates', icon: Layers, color: 'indigo' },
                                            { key: 'campaignLimit', usageKey: 'campaignsSent', label: 'Campaigns', icon: Zap, color: 'amber' },
                                            { key: 'contactLimit', usageKey: 'contactsCount', label: 'Contacts', icon: Users, color: 'blue' },
                                            { key: 'messageLimit', usageKey: 'messagesSent', label: 'Messages/mo', icon: MessageSquare, color: 'rose' }
                                        ].map((limit) => {
                                            const total = selectedControlUser.limits?.[limit.key] || 1;
                                            const used = selectedControlUser.usage?.[limit.usageKey] || 0;
                                            const percent = Math.min(100, (used / total) * 100);

                                            return (
                                                <div key={limit.key} className="space-y-3">
                                                    <div className="flex items-center justify-between px-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-1.5 rounded-lg bg-${limit.color}-50 text-${limit.color}-600`}>
                                                                <limit.icon size={12} />
                                                            </div>
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{limit.label}</label>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-bold text-slate-400">Used:</span>
                                                            <span className="text-[10px] font-black text-slate-900">{used.toLocaleString()}</span>
                                                        </div>
                                                    </div>

                                                    <div className="relative group/input">
                                                        <input
                                                            type="number"
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-[12px] px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all pr-16"
                                                            defaultValue={selectedControlUser.limits?.[limit.key] || 0}
                                                            onBlur={(e) => {
                                                                const value = parseInt(e.target.value);
                                                                if (value === selectedControlUser.limits?.[limit.key]) return;
                                                                const newLimits = { ...selectedControlUser.limits, [limit.key]: value };
                                                                handleUpdateLimits(selectedControlUser._id, newLimits);
                                                                setSelectedControlUser({ ...selectedControlUser, limits: newLimits });
                                                            }}
                                                        />
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest pointer-events-none">
                                                            Limit
                                                        </div>
                                                    </div>

                                                    {/* Usage Progress Bar */}
                                                    <div className="px-1">
                                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-1000 ${percent > 90 ? 'bg-rose-500' : percent > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">Utilized: {percent.toFixed(1)}%</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-8 p-4 bg-blue-50/50 border border-blue-100 rounded-[12px]">
                                        <div className="flex items-center gap-3">
                                            <AlertCircle size={16} className="text-blue-600" />
                                            <p className="text-[10px] font-bold text-blue-800 leading-tight">Changes to usage limits are immediate and override existing subscription plan quotas.</p>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 border-t border-slate-200 p-8 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2 text-slate-400">
                                <Activity size={16} className="text-blue-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Real-time Node: MASTER_UI_SYNC</span>
                            </div>
                            <button
                                onClick={() => { setShowControlModal(false); setSelectedControlUser(null); }}
                                className="px-10 py-5 bg-slate-900 text-white font-black rounded-[24px] text-xs uppercase tracking-widest shadow-2xl hover:bg-black transition-all"
                            >
                                Close Governance
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
