import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    Edit2,
    Trash2,
    Play,
    Pause,
    Clock,
    Lock,
    Zap,
    ChevronRight,
    AlertCircle,
    Copy,
    Settings,
    X,
    Activity,
    CheckCircle2,
    XCircle,
    ChevronDown
} from "lucide-react";
import api from "../../api/api";
import DensitySelector from "../../components/UI/DensitySelector";
import nicePrompt from "../../components/UI/NicePrompt";
import toast from "react-hot-toast";

const FilterDropdown = ({ icon: Icon, value, onChange, options }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = React.useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find((opt) => opt.value === value) || options[0];

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full min-w-[140px] h-9 px-4 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-slate-50 transition-all text-sm font-medium text-slate-700 shadow-sm"
            >
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="text-slate-400" size={14} />}
                    <span>{selectedOption?.label}</span>
                </div>
                <ChevronDown className={`text-slate-400 transition-transform duration-200 w-4 h-4 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 min-w-full w-max mt-1.5 bg-white border border-slate-100 rounded-xl shadow-xl shadow-slate-200/50 py-1.5 animate-in fade-in slide-in-from-top-2">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center justify-between gap-4 px-3 py-2 text-sm font-medium transition-colors ${
                                value === opt.value
                                    ? "bg-blue-50/50 text-blue-700"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                        >
                            <span className="whitespace-nowrap">{opt.label}</span>
                            {value === opt.value && <CheckCircle2 size={14} className="text-blue-600 shrink-0" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};


export default function FlowList() {
    const navigate = useNavigate();
    const location = useLocation();
    const [flows, setFlows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(() => {
        return Number(localStorage.getItem("flows_density")) || 10;
    });
    const [selectedFlowForLogs, setSelectedFlowForLogs] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    useEffect(() => {
        fetchFlows();
    }, [location.pathname]); // Refetch whenever returning to this page

    const fetchFlows = async () => {
        try {
            const res = await api.get("/flows");
            const fetchedFlows = res.data.flows || [];
            setFlows(fetchedFlows);

            // Auto-Onboarding: If no flows exist, create a default one
            if (fetchedFlows.length === 0) {
                createDefaultFlow();
            }
        } catch (err) {
            toast.error("Failed to load automation flows");
        } finally {
            setLoading(false);
        }
    };

    const createDefaultFlow = async () => {
        try {
            const defaultFlow = {
                name: "Welcome Automation",
                triggerType: "message_received",
                nodes: [
                    {
                        id: 'node_trigger_1',
                        type: 'custom',
                        position: { x: 250, y: 150 },
                        data: { type: 'trigger', label: 'Flow Starter' }
                    }
                ],
                connections: []
            };
            const res = await api.post("/flows", defaultFlow);
            // Navigate to the newly created flow
            navigate(`/automation/flows/${res.data.flow._id}`);
            toast.success("Welcome! We've created your first flow.");
        } catch (err) {
            console.error("Auto-creation failed", err);
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === "active" ? "paused" : "active";

        // Confirmation for pausing if active
        if (currentStatus === "active") {
            const confirmed = await nicePrompt.confirm(
                "Pause Automation",
                "Are you sure you want to pause this workflow? Active customers in this flow will stop receiving automated responses.",
                "warning"
            );
            if (!confirmed) return;
        }

        try {
            await api.patch(`/flows/${id}/status`, { status: newStatus });
            setFlows(flows.map(f => f._id === id ? { ...f, status: newStatus } : f));
            nicePrompt.success(
                newStatus === "active" ? "Workflow Active" : "Workflow Paused",
                `The flow has been successfully ${newStatus === "active" ? "activated" : "suspended"}.`
            );
        } catch (err) {
            nicePrompt.error("Status Update Failed", "The system was unable to synchronize the status change. Please try again.");
        }
    };

    const handleDelete = async (id, status) => {
        const message = status === "active"
            ? "This flow is currently active. Deleting it will permanently stop all ongoing customer interactions. Proceed with deletion?"
            : "Are you sure you want to move this automation to the trash? This cannot be undone.";

        const confirmed = await nicePrompt.confirm(
            "Delete Workflow",
            message,
            "danger"
        );

        if (!confirmed) return;

        try {
            await api.delete(`/flows/${id}`);
            setFlows(flows.filter(f => f._id !== id));
            nicePrompt.success("Workflow Deleted", "The automation flow has been permanently removed.");
        } catch (err) {
            nicePrompt.error("Delete Failed", err.response?.data?.error || "We couldn't process the deletion at this time.");
        }
    };

    const handleDuplicate = async (flow) => {
        try {
            const res = await api.get(`/flows/${flow._id}`);
            const fullFlow = res.data.flow;

            const payload = {
                name: `${fullFlow.name} (Copy)`,
                triggerType: fullFlow.triggerType,
                status: "draft",
                nodes: fullFlow.nodes,
                edges: fullFlow.edges
            };

            await api.post("/flows", payload);
            toast.success("Flow duplicated as draft");
            fetchFlows();
        } catch (err) {
            toast.error("Duplicate failed");
        }
    };

    const fetchLogs = async (flow) => {
        setSelectedFlowForLogs(flow);
        setLoadingLogs(true);
        setLogs([]);
        try {
            const res = await api.get(`/flows/${flow._id}/sessions`);
            setLogs(res.data.sessions || []);
        } catch (err) {
            toast.error("Failed to fetch execution logs");
        } finally {
            setLoadingLogs(false);
        }
    };


    const normalize = (str) => (str || "").toLowerCase().replace(/[\s_]/g, "");

    const filteredFlows = flows.filter(f => {
        const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || normalize(f.status) === normalize(statusFilter);
        const matchesType = typeFilter === "all" || normalize(f.triggerType) === normalize(typeFilter);

        return matchesSearch && matchesStatus && matchesType;
    });

    // Pagination logic
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = filteredFlows.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredFlows.length / rowsPerPage);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "active": return "bg-blue-100 text-blue-700 border-blue-200";
            case "paused": return "bg-amber-100 text-amber-700 border-amber-200";
            case "draft": return "bg-slate-100 text-slate-700 border-slate-200";
            default: return "bg-slate-100 text-slate-700";
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#f8fafc] font-poppins relative overflow-hidden">
            {/* ✅ HEADER SECTION */}
            <div className="shrink-0 px-5 py-4 space-y-4 font-poppins transition-all">
                {/* MODERN TOOLBAR */}
                <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-3 w-full">
                        <div className="relative w-full max-w-sm group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search automations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-sm font-medium text-slate-700 shadow-sm"
                            />
                        </div>

                        <FilterDropdown
                            icon={Filter}
                            value={statusFilter}
                            onChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}
                            options={[
                                { value: "all", label: "All Status" },
                                { value: "active", label: "Active" },
                                { value: "paused", label: "Paused" }
                            ]}
                        />

                        <FilterDropdown
                            icon={Zap}
                            value={typeFilter}
                            onChange={(val) => { setTypeFilter(val); setCurrentPage(1); }}
                            options={[
                                { value: "all", label: "All Types" },
                                { value: "keyword", label: "Keyword / Text" },
                                { value: "order_created", label: "Order Events" },
                                { value: "contact", label: "New Contact" },
                                { value: "campaign", label: "Campaign Response" },
                                { value: "payment_success", label: "Payments" }
                            ]}
                        />
                    </div>

                    <button
                        onClick={() => navigate("/automation/flows/new")}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 h-9 rounded-lg font-bold text-xs transition-all shadow-sm active:scale-95 shrink-0"
                    >
                        <Plus size={16} strokeWidth={3} />
                        Create Workflow
                    </button>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                    {[
                        { label: "Total Flows", value: filteredFlows.length, icon: Zap, bg: "bg-blue-50 text-blue-600 border border-blue-100" },
                        { label: "Active", value: filteredFlows.filter(f => normalize(f.status) === 'active').length, icon: Play, bg: "bg-emerald-50 text-emerald-600 border border-emerald-100" },
                        { label: "Paused", value: filteredFlows.filter(f => normalize(f.status) === 'paused').length, icon: Pause, bg: "bg-amber-50 text-amber-600 border border-amber-100" }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                            <div className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center shrink-0`}>
                                <stat.icon size={14} strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</span>
                                <span className="text-lg font-bold text-slate-800 leading-none">{stat.value}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Wrapper */}
            <div className="flex-1 overflow-hidden px-5 pb-5 flex flex-col pt-2">
                <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                    {/* Table Header Controls */}
                <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/30 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                            Showing <span className="text-blue-600 font-bold">{filteredFlows.length > 0 ? indexOfFirstRow + 1 : 0}-{Math.min(indexOfLastRow, filteredFlows.length)}</span> of {filteredFlows.length} Automations
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <DensitySelector
                            value={rowsPerPage}
                            onChange={(val) => {
                                setRowsPerPage(val);
                                localStorage.setItem("flows_density", val);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar p-4 bg-slate-50/20 space-y-4 w-full mx-auto animate-in fade-in duration-700">
                    {/* List View */}
                {loading ? (
                    <div className="grid grid-cols-1 gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 bg-slate-50 rounded-[12px] animate-pulse" />
                        ))}
                    </div>
                ) : filteredFlows.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-[24px] border border-slate-200 border-dashed border-2">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                            <Zap className="text-slate-200" size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">No flows found</h3>
                        <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">
                            {searchQuery ? "Try adjusting your search terms." : "Create your first automated flow to get started."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {currentRows.map((flow) => (
                            <div
                                key={flow._id}
                                className="group bg-white border border-slate-200 rounded-2xl p-3.5 hover:border-blue-500/50 hover:bg-blue-50/10 transition-all relative overflow-hidden shadow-sm hover:shadow-md"
                            >

                                <div className="flex flex-col xl:flex-row items-center justify-between gap-3">
                                    <div className="flex items-center gap-4 min-w-0 w-full">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${flow.status === 'active'
                                            ? 'bg-blue-600 text-white shadow-lg'
                                            : 'bg-slate-50 text-slate-400 border border-slate-100'
                                            }`}>
                                            <Zap size={18} strokeWidth={2.5} fill={flow.status === 'active' ? "currentColor" : "none"} />
                                        </div>
                                        <div className="min-w-0 space-y-0.5">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-[14px] font-bold text-slate-800 truncate underline decoration-blue-500/10 underline-offset-4 tracking-tight">{flow.name}</h3>
                                                <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest border ${getStatusColor(flow.status)}`}>
                                                    {flow.status}
                                                </span>
                                                {flow.isLocked && (
                                                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[8px] font-bold border border-rose-100 italic">
                                                        <Lock size={9} strokeWidth={3} /> LOCKED
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                                <span className="flex items-center gap-1.5">
                                                    <div className={`w-1 h-1 rounded-full ${flow.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                                    {flow.triggerType.split('_').join(' ').toLowerCase()}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Settings size={11} className="opacity-50" />
                                                    {flow.nodeCount || 0} Nodes
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Clock size={11} className="opacity-50" />
                                                    {new Date(flow.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {flow.status !== "draft" && (
                                            <button
                                                onClick={() => toggleStatus(flow._id, flow.status)}
                                                className={`flex items-center gap-2 px-3 h-8 rounded-lg font-bold text-[10px] transition-all border border-transparent
                                                    ${flow.status === 'active'
                                                        ? 'bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white shadow-sm shadow-amber-100'
                                                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white shadow-sm shadow-emerald-100'
                                                    }`}
                                            >
                                                {flow.status === 'active' ? <Pause size={11} strokeWidth={3} /> : <Play size={11} strokeWidth={3} />}
                                                {flow.status === 'active' ? 'Pause' : 'Activate'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => navigate(`/automation/flows/${flow._id}`)}
                                            className="flex items-center gap-2 px-3 h-8 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all font-bold text-[10px]"
                                        >
                                            <Edit2 size={11} strokeWidth={3} /> Open
                                        </button>
                                        <button
                                            onClick={() => fetchLogs(flow)}
                                            className="w-8 h-8 bg-white border border-slate-200 text-slate-400 rounded-lg flex items-center justify-center hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm"
                                            title="Execution History"
                                        >
                                            <Clock size={13} strokeWidth={2.5} />
                                        </button>
                                        <button
                                            onClick={() => handleDuplicate(flow)}
                                            className="w-8 h-8 bg-white border border-slate-200 text-slate-400 rounded-lg flex items-center justify-center hover:bg-slate-50 hover:text-blue-500 transition-all shadow-sm"
                                            title="Duplicate"
                                        >
                                            <Copy size={13} strokeWidth={2.5} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(flow._id, flow.status)}
                                            className="w-8 h-8 bg-white border border-slate-200 text-slate-400 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all"
                                            title="Delete"
                                        >
                                            <Trash2 size={13} strokeWidth={2.5} />
                                        </button>
                                    </div>

                                </div>
                            </div>
                        ))}
                    </div>
                )}

                </div>
                {/* ✅ PAGINATION CONTROLS */}
                {!loading && filteredFlows.length > 0 && (
                    <div className="px-5 py-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Page {currentPage} of {totalPages || 1}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="h-8 px-3 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                            >
                                Prev
                            </button>
                            <div className="flex gap-1">
                                {[...Array(totalPages)].map((_, i) => {
                                    const pageNum = i + 1;
                                    // Only show first, last, and pages around current
                                    if (totalPages > 7 && pageNum > 1 && pageNum < totalPages && Math.abs(pageNum - currentPage) > 1) {
                                        if (pageNum === 2 || pageNum === totalPages - 1) return <span key={pageNum} className="text-slate-300">...</span>;
                                        return null;
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => handlePageChange(pageNum)}
                                            className={`w-8 h-8 flex items-center justify-center text-[10px] font-black rounded-lg transition-all border cursor-pointer ${currentPage === pageNum
                                                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="h-8 px-3 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
                </div>
            </div>

            {/* 📜 LOGS MODAL */}
            {selectedFlowForLogs && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setSelectedFlowForLogs(null)} />
                    <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                    <Activity size={20} />
                                </div>
                                <div>
                                    <h3 className="text-[16px] font-bold text-slate-800 leading-tight">Execution History</h3>
                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{selectedFlowForLogs.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedFlowForLogs(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Logs List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-[400px]">
                            {loadingLogs ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-4 py-20">
                                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Records...</p>
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-200">
                                        <Activity size={32} />
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-800">No Activity Detected</h4>
                                    <p className="text-xs text-slate-400 mt-1">This flow hasn't been triggered by any customers yet.</p>
                                </div>
                            ) : (
                                logs.map((log) => (
                                    <div key={log._id} className="p-4 bg-slate-50 hover:bg-white border border-slate-100 hover:border-indigo-100 rounded-2xl transition-all flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-2 h-2 rounded-full ${log.status === 'completed' ? 'bg-emerald-500' :
                                                    log.status === 'failed' ? 'bg-rose-500' :
                                                        'bg-blue-500 animate-pulse'
                                                }`} />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[13px] font-bold text-slate-800">
                                                        {(!log.contactName || log.contactName === 'New Customer' || log.contactName === 'Unknown')
                                                            ? log.contactPhone
                                                            : `${log.contactName} (${log.contactPhone})`}
                                                    </p>
                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${log.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                            log.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                                                                'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {log.status}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 flex items-center gap-2">
                                                    Last Step: <span className="text-slate-600">{log.currentNodeId === 'TRIGGER_FAILED' ? 'Trigger Failed (No Match)' : log.currentNodeId?.split('_').pop() || 'Start'}</span>
                                                    {log.lastInput && <span className="text-slate-400 italic font-medium lowercase">| input: "{log.lastInput}"</span>}
                                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                    {new Date(log.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {new Date(log.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-center">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Live execution monitor</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
