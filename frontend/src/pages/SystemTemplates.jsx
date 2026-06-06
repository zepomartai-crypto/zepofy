import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";
import { Trash2, Eye, Edit, Plus, ArrowLeft, Loader2, Search, FileText, X, RefreshCw, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SystemTemplateForm from "../components/Templates/SystemTemplateForm";
import TemplatePreview from "../components/Templates/TemplatePreview";
import DensitySelector from "../components/UI/DensitySelector";
import nicePrompt from "../components/UI/NicePrompt";
import toast from "react-hot-toast";

export default function SystemTemplates() {
    const location = useLocation();
    const [templates, setTemplates] = useState([]);
    const [activeTab, setActiveTab] = useState("all");
    const [mode, setMode] = useState("list"); // 'list', 'create', 'edit'
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();

    const [form, setForm] = useState({
        name: "",
        type: "text",
        message: "",
        imageUrl: "",
        buttons: [],
        variables: []
    });

    const [showPreview, setShowPreview] = useState(false);
    const [selectedForPreview, setSelectedForPreview] = useState(null);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const res = await api.get("/system-templates");
            setTemplates(res.data || []);
        } catch {
            console.error("Failed to load templates");
            toast.error("Failed to load templates");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    // 🔥 Reset mode to list if navigating to the base system templates route (sidebar click)
    useEffect(() => {
        if (location.pathname === '/templates/system') {
            setMode("list");
            setEditingTemplate(null);
        }
    }, [location.pathname, location.key]);

    const handleCreate = () => {
        setForm({
            name: "",
            type: "text",
            message: "",
            imageUrl: "",
            buttons: [],
            variables: []
        });
        setMode("create");
    };

    const handleEdit = (template) => {
        setEditingTemplate(template);
        setForm({
            name: template.name,
            type: template.type,
            message: template.message,
            imageUrl: template.imageUrl || "",
            buttons: template.buttons || [],
            variables: template.variables || []
        });
        setMode("edit");
    };

    const handleDelete = async (id) => {
        const confirmed = await nicePrompt.confirm(
            "Delete System Template",
            "Are you sure you want to permanently delete this internal asset? This may affect flows currently using it.",
            "danger"
        );
        if (!confirmed) return;

        try {
            await api.delete(`/system-templates/${id}`);
            nicePrompt.success("Asset Deleted", "The system template has been removed from the repository.");
            loadTemplates();
        } catch {
            nicePrompt.error("Delete Failed", "The system was unable to remove this asset. Please try again later.");
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            if (mode === "create") {
                await api.post("/system-templates", form);
                nicePrompt.success("Template Created", "New system asset has been successfully registered.");
            } else {
                await api.put(`/system-templates/${editingTemplate._id}`, form);
                nicePrompt.success("Template Updated", "Internal asset configuration has been saved.");
            }
            setMode("list");
            loadTemplates();
        } catch {
            nicePrompt.error("Save Refused", "We encountered an issue while saving your configuration.");
        } finally {
            setSubmitting(false);
        }
    };

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const tabFilteredTemplates = filteredTemplates.filter(t => {
        if (activeTab === "all") return true;
        if (activeTab === "image") return t.type === "media" || t.type === "image";
        if (activeTab === "text") return t.type === "text";
        return true;
    });

    const totalPages = Math.ceil(tabFilteredTemplates.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTemplates = tabFilteredTemplates.slice(startIndex, startIndex + itemsPerPage);

    if (mode !== "list") {
        return (
            <div className="w-full space-y-2 animate-in fade-in duration-500">
                <div className={`flex-shrink-0 px-4 sm:px-8 font-sans pt-2 sm:pt-4 pb-4`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => setMode("list")}
                                className="group flex-shrink-0 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-white border border-slate-200 rounded-[12px] text-slate-400 hover:text-slate-900 hover:border-slate-900 transition-all shadow-sm active:scale-95"
                            >
                                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" strokeWidth={3} />
                            </button>
                            <div>
                                <h1 className="text-lg font-bold text-slate-900 tracking-tight font-poppins">
                                    {mode === 'create' ? 'New System Template' : 'Edit System Template'}
                                </h1>
                                <p className="hidden sm:block text-slate-400 font-bold text-[10px] mt-0.5 font-poppins uppercase tracking-widest leading-none">Design reusable internal components</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start px-5 sm:px-6">
                    <div className="xl:col-span-8 order-1">
                        <div className="bg-transparent">
                            <SystemTemplateForm
                                form={form}
                                setForm={setForm}
                                onSubmit={handleSubmit}
                                isSubmitting={submitting}
                            />
                        </div>
                    </div>

                    <div className="xl:col-span-4 order-2 sticky top-6">
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-6 px-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                    <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Live Preview</h4>
                                </div>
                                <div className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                    Real-time
                                </div>
                            </div>

                            <div className="flex items-center justify-center p-2 min-h-[400px]">
                                <TemplatePreview
                                    headerType={form.type === 'media' ? 'image' : 'none'}
                                    headerImage={form.imageUrl}
                                    bodyText={form.message}
                                    buttons={form.buttons.map(b => ({
                                        text: b.label,
                                        type: b.actionType === 'url' ? 'URL' : 'QUICK_REPLY'
                                    }))}
                                />
                            </div>

                            <p className="text-center mt-8 text-[11px] text-slate-400 font-medium max-w-[220px] mx-auto leading-relaxed">
                                This is a sample preview of how your message will appear to users.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-[#f8fafc] flex flex-col font-sans overflow-y-auto">
            {/* Page Header - UNIFIED WITH BACKGROUND */}
            <div className="flex-shrink-0 px-5 pt-4 pb-2 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md group">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="w-full h-9 pl-10 pr-4 bg-white border border-slate-200/60 rounded-lg text-xs font-medium text-slate-600 focus:border-blue-500 transition-all outline-none shadow-sm shadow-slate-200/10"
                        />
                    </div>

                    <button
                        onClick={handleCreate}
                        className="h-9 px-4 bg-blue-600 hover:bg-black text-white font-bold text-[11px] uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 active:scale-95 group shadow-sm"
                    >
                        <Plus size={14} strokeWidth={3} />
                        Add New Asset
                    </button>
                </div>

                {/* Filter Tabs - SYSTEMATIC CATEGORIES */}
                <div className="flex gap-6 border-b border-slate-200/40">
                    {[
                        { id: 'all', label: 'All Assets' },
                        { id: 'image', label: 'Images' },
                        { id: 'text', label: 'Text Only' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
                            className={`relative pb-2 text-xs font-bold transition-all duration-300 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-900'}`}
                        >
                            {tab.label}
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="activeTabUnderline"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 px-5 pb-5 overflow-hidden">
                {loading ? (
                    <div className="text-center py-40">
                        <div className="relative w-16 h-16 mx-auto mb-6">
                            <div className="absolute inset-0 border-3 border-blue-50 rounded-full"></div>
                            <div className="absolute inset-0 border-3 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                        </div>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[9px]">Syncing resources...</p>
                    </div>
                ) : paginatedTemplates.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-16 bg-white rounded-2xl border border-slate-200/60 shadow-sm max-w-4xl mx-auto"
                    >
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-6 border border-blue-100 shadow-inner">
                            <FileText className="w-7 h-7 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1 tracking-tight">No templates found</h3>
                        <p className="text-slate-500 mb-8 max-w-sm mx-auto text-xs font-bold leading-relaxed">
                            {searchQuery ? `We couldn't find any assets matching "${searchQuery}".` : "Start by creating reusable message blocks that can be used across your automation flows."}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={handleCreate}
                                className="inline-flex items-center px-8 py-3 bg-blue-600 text-white font-bold text-[11px] uppercase tracking-widest rounded-xl hover:bg-slate-900 transition-all shadow-md shadow-blue-500/10 active:scale-95"
                            >
                                <Plus size={16} strokeWidth={3} className="mr-2" /> Create First Asset
                            </button>
                        )}
                    </motion.div>
                ) : (
                    <>
                        <div className="h-full flex flex-col bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                            {/* Table Header Controls */}
                            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/30 shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Meta Content Library</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <DensitySelector
                                        value={itemsPerPage}
                                        onChange={(val) => {
                                            setItemsPerPage(val);
                                            setCurrentPage(1);
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto custom-scrollbar">
                                <table className="w-full border-separate border-spacing-0">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-slate-50/80 backdrop-blur-sm shadow-sm ring-1 ring-slate-200/20">
                                            <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Definition</th>
                                            <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Format</th>
                                            <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Sample</th>
                                            <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Created</th>
                                            <th className="px-5 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Operations</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {paginatedTemplates.map((template) => (
                                            <tr 
                                                key={template._id} 
                                                className="group hover:bg-blue-50/20 transition-all duration-200 cursor-pointer"
                                                onClick={(e) => {
                                                    if (e.target.closest('button')) return;
                                                    setSelectedForPreview(template);
                                                    setShowPreview(true);
                                                }}
                                            >
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100/50 group-hover:bg-white group-hover:border-blue-200 group-hover:shadow-sm text-slate-400 group-hover:text-blue-600 flex items-center justify-center shrink-0 transition-all">
                                                            <MessageSquare className="w-4.5 h-4.5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-800 text-sm truncate group-hover:text-blue-700">{template.name}</div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">ID_{template._id.slice(-8).toUpperCase()}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                                                        {template.type === 'media' || template.type === 'image' ? "IMAGE" : "TEXT"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 overflow-hidden">
                                                    <div className="text-slate-500 text-[11px] font-medium leading-relaxed truncate max-w-[200px] italic">
                                                        "{template.message?.substring(0, 60)}..."
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                                        {template.createdAt ? new Date(template.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "-"}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-right w-48">
                                                    <div className="flex items-center justify-end gap-1.5 transition-all">
                                                        <button
                                                            onClick={() => handleEdit(template)}
                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100"
                                                            title="Edit Details"
                                                        >
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedForPreview(template);
                                                                setShowPreview(true);
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all border border-transparent hover:border-slate-200"
                                                            title="View Asset"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(template._id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100"
                                                            title="Delete Registry"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between shrink-0">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Viewing <span className="text-blue-600 font-bold">{tabFilteredTemplates.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + itemsPerPage, tabFilteredTemplates.length)}</span> of {tabFilteredTemplates.length} Registry Entries
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        className="h-8 px-3 text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all text-slate-600 shadow-sm flex items-center justify-center cursor-pointer active:scale-95"
                                    >
                                        Prev
                                    </button>

                                    <div className="flex gap-1">
                                        {Array.from({ length: Math.min(3, totalPages || 1) }, (_, i) => {
                                            const pNum = i + 1;
                                            return (
                                                <button
                                                    key={pNum}
                                                    onClick={() => setCurrentPage(pNum)}
                                                    className={`w-8 h-8 text-[11px] font-bold rounded-lg transition-all ${currentPage === pNum
                                                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                                        : "bg-white border border-slate-200 text-slate-500 hover:border-blue-200"
                                                        }`}
                                                >
                                                    {pNum}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        className="h-8 px-3 text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all text-slate-600 shadow-sm flex items-center justify-center cursor-pointer active:scale-95"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>

                    </>
                )}
            </div>

            {/* PREVIEW MODAL - UPDATED TO 2-COLUMN LAYOUT */}
            {showPreview && selectedForPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[80vh] overflow-hidden border border-slate-200/50 animate-in zoom-in-95 duration-300">
                        {/* Corner Close Button */}
                        <button
                            onClick={() => setShowPreview(false)}
                            className="absolute top-4 right-4 z-[120] w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white text-slate-400 hover:text-red-500 rounded-full transition-all shadow-sm border border-slate-100/50 backdrop-blur-sm"
                            title="Close Preview"
                        >
                            <X size={20} strokeWidth={2.5} />
                        </button>

                        <div className="flex flex-col lg:flex-row h-full">
                            {/* LEFT: DETAILS - STRUCTURED WITH STICKY HEADER/FOOTER */}
                            <div className="flex-1 flex flex-col h-full bg-white border-r border-slate-100 min-w-0">
                                <div className="px-6 py-5 border-b border-slate-100/60 flex items-center justify-between bg-white/90 backdrop-blur-xl z-10 sticky top-0">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-11 h-11 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100/50 shadow-sm shadow-indigo-100/20">
                                            <Eye size={20} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 tracking-tight font-outfit">Template Details</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 leading-none font-poppins">Ref: {selectedForPreview._id.slice(-8).toUpperCase()}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* SCROLLABLE CONTENT AREA */}
                                <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 bg-slate-50/30 custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-2xl bg-white border border-slate-100/80 shadow-sm shadow-slate-100/50 group hover:border-indigo-200 transition-colors">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-poppins">Asset Classification</p>
                                            <p className="text-[13px] font-bold text-slate-700 capitalize flex items-center gap-2 font-inter">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                {selectedForPreview.type}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white border border-slate-100/80 shadow-sm shadow-slate-100/50 group hover:border-indigo-200 transition-colors">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-poppins">Registration Date</p>
                                            <p className="text-[13px] font-bold text-slate-700 flex items-center gap-2 font-inter">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                {new Date(selectedForPreview.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>

                                    {selectedForPreview.type === 'media' && selectedForPreview.imageUrl && (
                                        <div className="pt-2">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-poppins pl-1">Header Asset</p>
                                            <div className="rounded-2xl border border-slate-200/60 overflow-hidden bg-white shadow-md shadow-slate-200/20 group relative p-1.5">
                                                <img src={selectedForPreview.imageUrl} alt="Preview" className="w-full h-auto max-h-[200px] object-cover rounded-xl" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-poppins pl-1">Message Content</p>
                                        <div className="p-6 rounded-3xl bg-white border border-slate-100/80 text-[14px] text-slate-700 font-medium leading-relaxed whitespace-pre-wrap shadow-sm shadow-slate-100/50 italic font-inter">
                                            "{selectedForPreview.message}"
                                        </div>
                                    </div>

                                    {selectedForPreview.buttons?.length > 0 && (
                                        <div className="pt-2">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-poppins pl-1">Interactive Triggers</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {selectedForPreview.buttons.map((btn, i) => (
                                                    <div key={i} className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-slate-200/60 shadow-sm hover:border-indigo-200 transition-all group">
                                                        <span className="shrink-0 w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-[10px] font-black group-hover:bg-indigo-600 group-hover:text-white transition-colors">{i + 1}</span>
                                                        <span className="text-[12px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors font-inter">{btn.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* STICKY MODAL FOOTER */}
                                <div className="px-6 py-5 border-t border-slate-100/80 flex items-center justify-end gap-3 bg-white/90 backdrop-blur-xl z-10 sticky bottom-0">
                                    <button
                                        onClick={() => setShowPreview(false)}
                                        className="px-5 py-2.5 text-[11px] font-bold text-slate-400 hover:text-slate-700 transition-colors uppercase tracking-widest font-poppins"
                                    >
                                        Dismiss
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowPreview(false);
                                            handleEdit(selectedForPreview);
                                        }}
                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 uppercase tracking-widest flex items-center gap-2 font-poppins"
                                    >
                                        <Edit size={14} strokeWidth={3} />
                                        Modify Asset
                                    </button>
                                </div>
                            </div>
                            {/* RIGHT: PHONE PREVIEW - STICKY PREVIEW AREA */}
                            <div className="bg-slate-50/50 lg:w-[400px] shrink-0 p-6 flex flex-col items-center justify-center border-l border-slate-100 relative group overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-20" />
                                <div className="relative z-10 w-full flex flex-col items-center">
                                    <div className="mb-6 text-center">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 shadow-sm mb-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Real-time Visualization</span>
                                        </div>
                                    </div>
                                    <div className="scale-[0.8] origin-center transition-all duration-500">
                                        <TemplatePreview
                                            headerType={selectedForPreview.type === 'media' ? 'image' : 'none'}
                                            headerImage={selectedForPreview.imageUrl}
                                            bodyText={selectedForPreview.message}
                                            buttons={(selectedForPreview.buttons || []).map(b => ({ text: b.label, type: b.actionType === 'url' ? 'URL' : 'QUICK_REPLY' }))}
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-bold text-center mt-8 max-w-[200px] leading-relaxed uppercase tracking-widest opacity-60">
                                        Standardized mobile interface preview
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
