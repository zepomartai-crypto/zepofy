import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";
import CampaignPreview from "../components/CampaignPreview";
import nicePrompt from "../components/UI/NicePrompt";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import {
    TrendingUp,
    Users,
    MessageSquare,
    ChevronLeft,
    ChevronDown,
    RefreshCw,
    Search,
    Filter,
    UserPlus,
    X,
    Plus,
    Phone,
    Clock,
    Calendar
} from "lucide-react";
import Modal from "../components/UI/Modal";

export default function CampaignDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [campaign, setCampaign] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAddNumberModalOpen, setIsAddNumberModalOpen] = useState(false);
    const [newRecipient, setNewRecipient] = useState({ phone: "", name: "" });
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [segmentType, setSegmentType] = useState("all");
    const [groupAction, setGroupAction] = useState("create"); // "create" or "append"
    const [newGroupName, setNewGroupName] = useState("");
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [allGroups, setAllGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);

    const fetchCampaignData = useCallback(async (showLoading = false) => {
        try {
            if (showLoading) setLoading(true);
            else setRefreshing(true);

            const [campRes, analyticsRes] = await Promise.all([
                api.get(`/campaigns/${id}`),
                api.get(`/campaigns/${id}/analytics`)
            ]);

            setCampaign(campRes.data.campaign);
            setAnalytics(analyticsRes.data.data);
        } catch (err) {
            console.error("Failed to fetch campaign data:", err);

            // 🛑 CRITICAL: If the error is 404 (Campaign not found), we should stop polling or redirect
            if (err.response?.status === 404) {
                console.warn("Campaign not found. Redirecting...");
                return navigate("/campaigns");
            }

            // 📢 Only show the ERROR MODAL on the first load to avoid annoying "again and again" popups
            if (showLoading) {
                nicePrompt.error("Error", "Could not load campaign details. Please check your connection.");
            } else {
                // Background refresh failed - silent log to avoid blocking the user
                console.warn("Background refresh failed. Will retry in 5s.");
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id, navigate]);

    useEffect(() => {
        fetchCampaignData(true);
    }, [fetchCampaignData]);

    // Auto polling
    useEffect(() => {
        const interval = setInterval(() => {
            fetchCampaignData();
        }, 10000); // 🕒 Increased to 10s to reduce server load
        return () => clearInterval(interval);
    }, [fetchCampaignData]);

    const createGroup = async (type) => {
        if (isProcessing) return;
        try {
            const label = type === 'all' ? 'All Recipients' : type === 'read' ? 'Seen (Not Replied)' : type === 'replied' ? 'Replied' : 'Failed Delivery';
            const defaultName = `${campaign.name} - ${label} (${new Date().toLocaleDateString()})`;
            const groupName = await nicePrompt.ask(
                "Group Identity",
                `Please define a name for your new segment of contacts from the "${label}" list.`,
                "Enter group name...",
                defaultName
            );

            if (!groupName) return;

            setIsProcessing(true);
            const res = await api.post(`/campaigns/${id}/create-group-from-engagement`, {
                type,
                groupName
            });

            if (res.data.success) {
                nicePrompt.success("Segment Created", `Your new group "${res.data.group.name}" is now active with ${res.data.group.memberCount} profiles.`);
                // Small delay to let users see success before redirect or refresh
            }
        } catch (err) {
            console.error("Grouping error details:", err);
            const errorMsg = err.response?.data?.error || err.message || "We could not generate the contact group at this time.";
            nicePrompt.error("Operation Failed", errorMsg);
        } finally {
            setIsProcessing(false);
        }
    };

    const statusBadge = (status) => {
        const map = {
            draft: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", label: "Draft" },
            scheduled: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", label: "Scheduled" },
            running: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", label: "Running" },
            completed: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", label: "Completed" },
            failed: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", label: "Failed" },
            read: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-200", label: "Read" },
            sent: { bg: "bg-sky-50", text: "text-sky-600", border: "border-sky-200", label: "Sent" },
            delivered: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", label: "Delivered" },
            pending: { bg: "bg-slate-50", text: "text-slate-400", border: "border-slate-100", label: "Pending" },
        };
        const config = map[status] || map.draft;
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-widest border ${config.bg} ${config.text} ${config.border}`}>
                {status === "running" && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>}
                {config.label}
            </span>
        );
    };

    const filteredRecipients = (analytics?.recipients || []).filter(r => {
        const matchesSearch = !searchTerm || r.phone?.includes(searchTerm) || r.name?.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesStatus = true;
        if (statusFilter === "read") {
            // Strict: Seen BUT NOT replied (Match backend)
            matchesStatus = r.status === "read" && !r.repliedAt;
        } else if (statusFilter === "replied") {
            // Strict: Must have replied
            matchesStatus = !!r.repliedAt;
        } else if (statusFilter === "failed") {
            matchesStatus = r.status === "failed";
        }

        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Analytics...</p>
                </div>
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="h-full flex items-center justify-center bg-white p-6">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Campaign Not Found</h2>
                    <button onClick={() => navigate("/campaigns")} className="text-blue-600 font-bold hover:underline">Go back to campaigns</button>
                </div>
            </div>
        );
    }

    const completionPercent = campaign.status === "completed" ? 100 : Math.round(((campaign.sentCount || 0) / (campaign.total || 1)) * 100);

    return (
        <div className="h-screen flex flex-col bg-[#fdfdfd] overflow-hidden font-poppins">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate("/campaigns")}
                        className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{campaign.name}</h2>
                            {statusBadge(campaign.status)}
                        </div>
                        <p className="text-sm text-slate-500 font-medium mt-0.5">Campaign Intelligence & Performance Dashboard</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchCampaignData()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm group"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-blue-500 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                        Refresh Data
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-8 pt-4 flex flex-col">
                {campaign.status === 'scheduled' && campaign.scheduledAt && (
                    <div className="mb-6 p-6 bg-amber-50/50 border-2 border-amber-100 rounded-[28px] flex items-center justify-between animate-in slide-in-from-top-4 duration-700 shadow-sm">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm shrink-0 border border-amber-200/50">
                                <Clock size={28} />
                            </div>
                            <div>
                                <h3 className="text-[16px] font-black text-amber-900 uppercase tracking-tight leading-none mb-2">Campaign Scheduled</h3>
                                <p className="text-[13px] font-bold text-amber-700/80 flex items-center gap-2">
                                    <Calendar size={14} />
                                    Launching on {new Date(campaign.scheduledAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    <span className="w-1 h-1 bg-amber-300 rounded-full"></span>
                                    at {new Date(campaign.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>

                        <div className="hidden lg:block px-6 py-3 bg-white/50 rounded-2xl border border-amber-100 text-[11px] font-black text-amber-600 uppercase tracking-widest">
                            {Math.max(0, Math.ceil((new Date(campaign.scheduledAt) - new Date()) / (1000 * 60 * 60)))} Hours Remaining
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-12 gap-8 h-full min-h-0">

                    {/* Metrics Sidebar */}
                    <div className="col-span-3 flex flex-col min-h-0 h-full space-y-4 overflow-hidden pr-2">
                        <div className="bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-5 shrink-0">
                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 font-poppins">Progress Status</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700 font-poppins">Completion</span>
                                    <span className="text-xs font-black text-blue-600">{completionPercent}%</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-1000 ease-out"
                                        style={{ width: `${completionPercent}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    <span>{campaign.sentCount || 0} Sent</span>
                                    <span>{campaign.total || 0} Total</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-5 shrink-0">
                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 font-poppins">Delivery Timeline</h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mt-1.5 shrink-0"></div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Created</p>
                                        <p className="text-[11px] font-bold text-slate-700 truncate">{new Date(campaign.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                                    </div>
                                </div>
                                {campaign.scheduledAt && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.4)]"></div>
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Scheduled For</p>
                                            <p className="text-[11px] font-bold text-slate-700 truncate">{new Date(campaign.scheduledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                                        </div>
                                    </div>
                                )}
                                {campaign.startedAt && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.4)]"></div>
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">Execution Started</p>
                                            <p className="text-[11px] font-bold text-slate-700 truncate">{new Date(campaign.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                                        </div>
                                    </div>
                                )}
                                {campaign.completedAt && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">Completed</p>
                                            <p className="text-[11px] font-bold text-slate-700 truncate">{new Date(campaign.completedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-5 space-y-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest font-poppins">Performance Stats</h3>

                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: "Total", val: analytics?.totalRecipients ?? campaign.total ?? 0, color: "slate" },
                                    { label: "Sent", val: analytics?.sent ?? campaign.sentCount ?? 0, color: "blue" },
                                    { label: "Delivered", val: analytics?.delivered ?? campaign.deliveredCount ?? 0, color: "sky" },
                                    { label: "Read", val: analytics?.read ?? campaign.readCount ?? 0, color: "indigo" },
                                    { label: "Failed", val: analytics?.failed ?? campaign.failedCount ?? 0, color: "red" },
                                    { label: "Replies", val: analytics?.replies ?? campaign.replyCount ?? 0, color: "orange" }
                                ].map((s, i) => (
                                    <div key={i} className="text-center p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100/50">
                                        <div className={`text-lg font-black text-${s.color}-600 leading-none mb-1`}>{s.val}</div>
                                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-5 pt-1">
                                {[
                                    { label: "Delivery Rate", val: analytics?.deliveryRate, color: "bg-blue-500", text: "text-blue-500" },
                                    { label: "Read Rate", val: analytics?.readRate, color: "bg-indigo-500", text: "text-indigo-500" },
                                    { label: "Reply Rate", val: analytics?.replyRate, color: "bg-orange-500", text: "text-orange-500" }
                                ].map((r, i) => (
                                    <div key={i}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{r.label}</span>
                                            <span className={`text-xs font-black ${r.text} leading-none`}>{r.val}%</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                            <div className={`h-full ${r.color} transition-all duration-1000`} style={{ width: `${r.val}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Main List */}
                    <div className="col-span-6 flex flex-col min-h-0 h-full bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden relative">
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest font-poppins">Live Recipient Log</h3>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search phone..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="bg-slate-100/80 placeholder-slate-500 border-none rounded-lg py-2 pl-9 pr-4 text-[10px] font-black text-slate-800 focus:ring-2 focus:ring-blue-500/20 w-32 transition-all outline-none font-poppins"
                                    />
                                </div>
                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                                    {["all", "read", "replied", "failed"].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setStatusFilter(f)}
                                            className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter transition-all font-poppins ${statusFilter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setIsAddNumberModalOpen(true)}
                                    disabled={isProcessing}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 border border-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md active:scale-95"
                                >
                                    {isProcessing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                                    Add Number
                                </button>
                                <button
                                    onClick={async () => {
                                        setSegmentType(statusFilter);
                                        const label = statusFilter === 'all' ? 'All Recipients' : statusFilter === 'read' ? 'Seen (Not Replied)' : statusFilter === 'replied' ? 'Replied' : 'Failed Delivery';
                                        setNewGroupName(`${campaign.name} - ${label} (${new Date().toLocaleDateString()})`);
                                        setGroupAction("create");
                                        setSelectedGroupId("");
                                        setIsGroupModalOpen(true);

                                        try {
                                            setLoadingGroups(true);
                                            const res = await api.get("/contact-groups", { params: { limit: 1000 } });
                                            setAllGroups(res.data.groups || []);
                                        } catch (err) {
                                            console.error("Failed to load groups:", err);
                                        } finally {
                                            setLoadingGroups(false);
                                        }
                                    }}
                                    disabled={isProcessing}
                                    className={`flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-md active:scale-95 ${isProcessing ? 'opacity-50 animate-pulse' : ''}`}
                                >
                                    {isProcessing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
                                    Save Segment
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-separate border-spacing-0">
                                <thead className="bg-slate-50/50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-50 font-poppins">Recipient</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center border-b border-slate-50 font-poppins">Status</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center border-b border-slate-50 font-poppins">Activity</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredRecipients.length > 0 ? (
                                        filteredRecipients.map((r, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-5">
                                                    <div className="text-[16px] font-medium text-slate-900 leading-tight mb-0.5">
                                                        {r.name || "Valued Customer"}
                                                    </div>
                                                    <div className="text-[14px] font-normal text-slate-500 tracking-tight">
                                                        {r.phone?.startsWith('+') ? r.phone : `+${r.phone}`}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col items-center gap-2">
                                                        {statusBadge(r.status)}
                                                        <div className="flex gap-1">
                                                            {r.status === 'read' && <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">SEEN</span>}
                                                            {r.repliedAt && <span className="text-[8px] font-black bg-orange-500 text-white px-2 py-0.5 rounded-full">REPLIED</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <div className="font-black text-slate-900 text-xs">
                                                        {r.readAt ? new Date(r.readAt).toLocaleTimeString() :
                                                            r.deliveredAt ? new Date(r.deliveredAt).toLocaleTimeString() :
                                                                r.sentAt ? new Date(r.sentAt).toLocaleTimeString() :
                                                                    r.createdAt ? new Date(r.createdAt).toLocaleTimeString() : "Ready"}
                                                    </div>
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                                        {r.readAt ? "Viewed" : r.deliveredAt ? "Delivered" : r.sentAt ? "Sent" : r.createdAt ? "Added" : ""}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="py-20 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-20">
                                                    <Search size={48} />
                                                    <span className="text-sm font-black uppercase tracking-[0.2em]">No Recipients Found</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Preview Panel */}
                    <div className="col-span-3 flex flex-col min-h-0 h-full overflow-hidden">
                        <div className="bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-6 flex flex-col h-full overflow-hidden items-center">
                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 shrink-0 w-full text-center font-poppins">{campaign.template?.name || "Campaign Preview"}</h3>
                            <div className="flex-1 w-full min-h-0 overflow-y-auto custom-scrollbar flex flex-col items-center origin-top">
                                <CampaignPreview
                                    template={campaign.template}
                                    variables={campaign.template?.variableTypes || campaign.template?.variables || []}
                                    headerOverride={campaign.headerOverrideUrl || campaign.headerOverrideHandle || null}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Number Modal */}
            <Modal
                isOpen={isAddNumberModalOpen}
                onClose={() => {
                    setIsAddNumberModalOpen(false);
                    setNewRecipient({ phone: "", name: "" });
                }}
                title="Add New Recipient"
                size="sm"
            >
                <div className="p-6 space-y-6 bg-slate-50/30">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp Number</label>
                            <div className="premium-phone-input-wrapper">
                                <PhoneInput
                                    country={"in"}
                                    value={newRecipient.phone}
                                    onChange={(phone, country) => {
                                        setNewRecipient(prev => ({ ...prev, phone }));
                                        setNewRecipient(prev => ({ ...prev, countryData: country }));
                                    }}
                                    containerClass="!w-full !border-none"
                                    inputClass="!w-full !h-14 !pl-16 !bg-white !border-2 !border-slate-100 !rounded-2xl !text-[15px] !font-bold !text-slate-900 !shadow-sm focus:!border-blue-500 !transition-all"
                                    buttonClass="!bg-white !border-2 !border-slate-100 !border-r-0 !rounded-l-2xl !hover:bg-slate-50 !w-14"
                                    dropdownClass="!rounded-2xl !shadow-2xl !border-slate-100 !text-sm !font-bold"
                                    placeholder="Enter WhatsApp number"
                                    enableSearch={true}
                                />
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 ml-1 flex items-center gap-1.5 italic">
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                Selected country code will be added automatically
                            </p>
                        </div>

                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Recipient Name (Optional)</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                    <Users size={16} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="e.g. John Doe"
                                    value={newRecipient.name}
                                    onChange={(e) => setNewRecipient(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-900 shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => {
                                setIsAddNumberModalOpen(false);
                                setNewRecipient({ phone: "", name: "" });
                            }}
                            className="flex-1 h-12 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={newRecipient.phone.length < 5 || isProcessing}
                            onClick={async () => {
                                try {
                                    setIsProcessing(true);
                                    const cleanPhone = newRecipient.phone.replace(/\D/g, "");

                                    // 🔥 10-digit validation for India
                                    if (newRecipient.countryData?.dialCode === "91" && cleanPhone.length !== 12) {
                                        nicePrompt.error("Invalid Number", "Indian WhatsApp numbers must be exactly 10 digits (Excluding +91).");
                                        setIsProcessing(false);
                                        return;
                                    }

                                    // General length validation
                                    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
                                        nicePrompt.error("Invalid Number", "Phone number must be between 10 to 15 digits including country code.");
                                        setIsProcessing(false);
                                        return;
                                    }

                                    await api.post(`/campaign-numbers/${id}/numbers`, {
                                        phone: cleanPhone,
                                        name: newRecipient.name,
                                        countryCode: newRecipient.countryData?.dialCode || "91"
                                    });
                                    nicePrompt.success("Success", "Recipient added to campaign.");
                                    setIsAddNumberModalOpen(false);
                                    setNewRecipient({ phone: "", name: "" });
                                    fetchCampaignData();
                                } catch (err) {
                                    nicePrompt.error("Error", err.response?.data?.error || "Could not add recipient.");
                                } finally {
                                    setIsProcessing(false);
                                }
                            }}
                            className="flex-1 h-12 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                        >
                            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Add Number
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Group Engagement Segment Modal */}
            <Modal
                isOpen={isGroupModalOpen}
                onClose={() => setIsGroupModalOpen(false)}
                title="Save Segment to Group"
                size="md"
            >
                <div className="p-6 space-y-6 bg-slate-50/30">
                    <div className="space-y-4">
                        {/* Segment Info badge */}
                        <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center justify-between">
                            <div>
                                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none block mb-1">Target Segment</span>
                                <span className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                                    {segmentType === 'all' ? 'All Recipients' : segmentType === 'read' ? 'Seen (Not Replied)' : segmentType === 'replied' ? 'Replied' : 'Failed Delivery'}
                                </span>
                            </div>
                            <div className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-full">
                                {filteredRecipients.length} profiles
                            </div>
                        </div>

                        {/* Action selector */}
                        <div className="grid grid-cols-2 gap-4 font-poppins">
                            <button
                                onClick={() => setGroupAction("create")}
                                className={`p-4 rounded-2xl border-2 text-left transition-all ${groupAction === "create" ? "border-blue-500 bg-blue-50/20 shadow-sm" : "border-slate-100 bg-white hover:bg-slate-50"}`}
                            >
                                <span className="block text-sm font-bold text-slate-800">Create New Group</span>
                                <span className="block text-[10px] text-slate-400 font-medium mt-1 leading-normal">Save these profiles into a brand new contact group list.</span>
                            </button>
                            <button
                                onClick={() => setGroupAction("append")}
                                className={`p-4 rounded-2xl border-2 text-left transition-all ${groupAction === "append" ? "border-blue-500 bg-blue-50/20 shadow-sm" : "border-slate-100 bg-white hover:bg-slate-50"}`}
                            >
                                <span className="block text-sm font-bold text-slate-800">Add to Existing Group</span>
                                <span className="block text-[10px] text-slate-400 font-medium mt-1 leading-normal">Append these profiles into a pre-existing contact group.</span>
                            </button>
                        </div>

                        {/* Action details */}
                        {groupAction === "create" ? (
                            <div className="space-y-2">
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 font-poppins">New Group Name</label>
                                <input
                                    type="text"
                                    placeholder="Enter unique group name..."
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-900 shadow-sm font-poppins"
                                />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 font-poppins">Select Target Group</label>
                                <div className="relative">
                                    <select
                                        value={selectedGroupId}
                                        onChange={(e) => setSelectedGroupId(e.target.value)}
                                        className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-900 shadow-sm appearance-none cursor-pointer font-poppins"
                                        disabled={loadingGroups}
                                    >
                                        <option value="" disabled>-- Choose a pre-existing group --</option>
                                        {allGroups.map(g => (
                                            <option key={g._id} value={g._id}>
                                                {g.name} ({g.membersCount || g.contactIds?.length || 0} members)
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                                {loadingGroups && <p className="text-[10px] font-bold text-blue-500 animate-pulse ml-1">Loading group hubs...</p>}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => setIsGroupModalOpen(false)}
                            className="flex-1 h-12 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all active:scale-95 font-poppins"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={isProcessing || (groupAction === "create" && !newGroupName.trim()) || (groupAction === "append" && !selectedGroupId)}
                            onClick={async () => {
                                try {
                                    setIsProcessing(true);
                                    const payload = {
                                        type: segmentType
                                    };
                                    if (groupAction === "create") {
                                        payload.groupName = newGroupName;
                                    } else {
                                        payload.groupId = selectedGroupId;
                                    }

                                    const res = await api.post(`/campaigns/${id}/create-group-from-engagement`, payload);

                                    if (res.data.success) {
                                        nicePrompt.success(
                                            groupAction === "create" ? "Segment Created" : "Group Updated",
                                            groupAction === "create"
                                                ? `Your new group "${res.data.group.name}" is now active with ${res.data.group.memberCount || res.data.group.contactIds?.length || 0} profiles.`
                                                : `The group "${res.data.group.name}" has been updated and now has ${res.data.group.memberCount || res.data.group.contactIds?.length || 0} profiles.`
                                        );
                                        setIsGroupModalOpen(false);
                                        fetchCampaignData();
                                    }
                                } catch (err) {
                                    console.error("Group action error details:", err);
                                    nicePrompt.error("Operation Failed", err.response?.data?.error || err.message || "We could not update the contact group at this time.");
                                } finally {
                                    setIsProcessing(false);
                                }
                            }}
                            className="flex-1 h-12 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 font-poppins"
                        >
                            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                            {groupAction === "create" ? "Create Segment" : "Add to Group"}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
