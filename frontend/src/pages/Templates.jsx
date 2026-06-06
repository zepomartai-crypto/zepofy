import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api/api";
import { getImageUrl } from "../utils/imageHelpers";
import { Trash2, AlertTriangle, Eye, Edit, Send, CheckCircle, Clock, XCircle, X, Plus, Info, Phone, ArrowLeft, Loader2, RefreshCw, MessageSquare, Tag, Search, ChevronDown } from "lucide-react";
import nicePrompt from "../components/UI/NicePrompt";
import { cn } from "../utils/cn";



import CustomSelect from "../components/UI/CustomSelect";
import DensitySelector from "../components/UI/DensitySelector";
import TemplateForm from "../components/Templates/TemplateForm";
import TemplatePreview from "../components/Templates/TemplatePreview";


// Helper function to get full image URL
// getImageUrl is now imported from utils/imageHelpers

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [mode, setMode] = useState("list");
  const [activeTab, setActiveTab] = useState("all");
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [selectedType, setSelectedType] = useState("all");



  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();

  // ✅ PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    return Number(localStorage.getItem("templates_density")) || 10;
  });
  const [searchQuery, setSearchQuery] = useState("");

  const [saving, setSaving] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState({
    uploading: false,
    stage: '', // 'server', 'meta-media', 'meta-template', 'complete'
    error: null
  });

  const [form, setForm] = useState({
    name: "",
    category: "UTILITY",
    language: "en_US",
    header: { type: "none" },
    body: "",
    footer: "",
    buttons: [],
  });

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get("/templates");
      const templates = res.data.templates || [];
      setTemplates(templates);

      setTemplates(templates);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ SYNC MODE WITH URL
  useEffect(() => {
    const path = location.pathname;
    if (path.includes("/create")) {
      setMode("create");
    } else if (path.includes("/edit")) {
      setMode("edit");
      if (id && templates.length > 0) {
        const t = templates.find(x => x._id === id);
        if (t) setEditingTemplate(t);
      }
    } else {
      setMode("list");
      setEditingTemplate(null);
    }
  }, [location.pathname, id, templates]);

  // ✅ POPULATE FORM WHEN EDITING TEMPLATE
  useEffect(() => {
    if (mode === "edit" && editingTemplate) {
      console.log("📝 Populating form for editing:", editingTemplate);

      setForm({
        name: editingTemplate.name || "",
        category: editingTemplate.category || "UTILITY",
        language: editingTemplate.language || "en_US",
        header: editingTemplate.header?.type === "image"
          ? {
            type: "image",
            image: editingTemplate.header.image,
            preview: getImageUrl(editingTemplate.header.image),
          }
          : (editingTemplate.header || { type: "none" }),
        body: editingTemplate.body || "",
        footer: editingTemplate.footer || "",
        buttons: editingTemplate.buttons || [],
      });
    }
  }, [mode, editingTemplate]);


  /* ================= IMAGE URL VALIDATION ================= */
  useEffect(() => {
    if (form.header?.type === "image") {
      const url = form.header.image;

      if (!url) {
        setImageError("Image URL is required");
      } else if (!url.startsWith("https://")) {
        setImageError("Image must be a public HTTPS URL");
      } else {
        setImageError(null);
      }
    } else {
      setImageError(null);
    }
  }, [form.header]);



  const syncWithMeta = async () => {
    setSyncing(true);
    try {
      await api.get("/templates/sync/meta");
      await loadTemplates();
    } catch (error) {
      console.error("Failed to sync with Meta:", error);
    } finally {
      setSyncing(false);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    // 1. Status Filter
    const statusMatch = activeTab === "all" || t.metaStatus === activeTab;

    // 2. Category Filter
    const categoryMatch = selectedCategory === "all" ||
      (t.category && t.category.toLowerCase() === selectedCategory.toLowerCase());

    // 3. Language Filter
    const languageMatch = selectedLanguage === "all" ||
      (t.language && (t.language.toLowerCase() === selectedLanguage.toLowerCase() || t.language.split('_')[0] === selectedLanguage));

    // 4. Type Filter
    const type = t.header?.type === "image" ? "image" : t.buttons?.length > 0 ? "action" : "text";
    const typeMatch = selectedType === "all" || type === selectedType;

    return statusMatch && categoryMatch && languageMatch && typeMatch;
  });

  // ✅ SEARCH FILTER
  const searchedTemplates = filteredTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ✅ PAGINATION LOGIC
  const totalPages = Math.ceil(searchedTemplates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTemplates = searchedTemplates.slice(startIndex, startIndex + itemsPerPage);



  // ✅ RESET PAGE WHEN SEARCH CHANGES
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, selectedCategory, selectedLanguage, selectedType]);

  const createTemplate = async () => {
    // Validation
    if (!form.name.trim()) {
      nicePrompt.error("Template Name Required", "Please provide a unique name for your template to continue.");
      return;
    }
    if (!form.body.trim()) {
      nicePrompt.error("Empty Body Content", "The message body is empty. Type your message to see how it looks in the preview.");
      return;
    }

    // Validate variables ratio
    const variables = form.body.match(/{{\d+}}/g) || [];
    const bodyTextLength = form.body.replace(/{{\d+}}/g, '').trim().length;
    if (variables.length > 0 && bodyTextLength < variables.length * 10) {
      nicePrompt.error("Content Consistency", `Your message body is too short for ${variables.length} variables. Please add more descriptive content.`);
      return;
    }

    if (form.buttons.length > 3) {
      nicePrompt.error("Button Limit", "WhatsApp templates only support up to 3 interactive buttons.");
      return;
    }

    // ✅ REQUIREMENT: Dynamic variable validation
    const missingValues = variables.filter(v => !form.variableValues?.[v] || form.variableValues[v].trim() === "");
    if (missingValues.length > 0) {
      nicePrompt.error("Incomplete Variables", "Please fill in all variable placeholders to ensure your template renders correctly.");
      return;
    }

    setSaving(true);
    try {
      // ✅ REQUIREMENT: Extract variables for payload: ["1", "2"]
      const varIndices = variables.map(v => v.match(/\d+/)[0]);

      const payload = { ...form, variables: varIndices };
      await api.post("/templates", payload);

      setForm({
        name: "",
        category: "UTILITY",
        language: "en_US",
        header: { type: "none" },
        body: "",
        footer: "",
        buttons: [],
      });
      loadTemplates();
      navigate("/templates");
      nicePrompt.success("Template Created", "Your new WhatsApp template has been successfully drafted.");
    } catch (error) {
      console.error("Failed to create template:", error);
      nicePrompt.error("Creation Failed", error.response?.data?.error || error.response?.data?.details || "We encountered an error while saving your template.");
    } finally {
      setSaving(false);
    }
  };

  const submitToMeta = async (id) => {
    setSubmittingId(id); // 👈 only this template is submitting
    try {
      await api.post(`/templates/${id}/submit`);
      await loadTemplates();
      nicePrompt.success("Template Submitted", "Your template has been sent to Meta for approval.");
    } catch (error) {
      console.error("Failed to submit to Meta:", error);
      nicePrompt.error("Submission Failed", error.response?.data?.error || error.response?.data?.details || "Failed to submit your template to Meta.");
    } finally {
      setSubmittingId(null);
    }
  };

  // ================= DELETE TEMPLATE FUNCTIONS =================
  const deleteTemplate = async (template) => {
    const confirmed = await nicePrompt.confirm(
      "Delete Template",
      `Are you sure you want to permanently remove "${template.name}"? This action cannot be undone.`,
      "danger"
    );
    if (!confirmed) return;

    try {
      console.log(`🗑️ Deleting template: ${template.name}`);
      await api.delete(`/templates/${template._id}`);

      // Remove from UI immediately
      setTemplates(prev => prev.filter(t => t._id !== template._id));

      console.log(`✅ Template deleted successfully: ${template.name}`);

      // Show success message
      nicePrompt.success("Template Removed", `"${template.name}" has been deleted from your archive.`);

    } catch (error) {
      console.error('Failed to delete template:', error);
      nicePrompt.error("Action Prohibited", error.response?.data?.error || error.response?.data?.message || "This template could not be deleted at this time.");
    }
  };

  // ================= UPDATE TEMPLATE FUNCTION =================
  const updateTemplate = async () => {
    if (!editingTemplate) return;

    setSaving(true);

    try {
      console.log('📝 Updating template:', editingTemplate.name);

      const payload = {
        name: form.name,
        category: form.category,
        body: form.body,
        header: form.header,
        footer: form.footer,
        buttons: form.buttons,
        language: form.language,
        variables: (form.body.match(/{{\d+}}/g) || []).map(v => v.match(/\d+/)[0]),
        variableValues: form.variableValues
      };

      const res = await api.put(`/templates/${editingTemplate._id}`, payload);

      console.log('✅ Template updated successfully');

      // Reload templates to get updated data
      await loadTemplates();

      // Reset form and go back to list
      navigate("/templates");
      setEditingTemplate(null);
      setForm({
        name: "",
        category: "UTILITY",
        language: "en_US",
        header: { type: "none" },
        body: "",
        footer: "",
        buttons: [],
      });

      nicePrompt.success("Changes Saved", "Your template configuration has been updated successfully.");

    } catch (error) {
      console.error('❌ Failed to update template:', error);
      nicePrompt.error("Update Refused",
        error.response?.data?.error ||
        error.response?.data?.details?.message ||
        "The system was unable to save your changes."
      );
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden">
      {/* Page Header */}
      {mode === "list" && (
        <div className="px-5 py-4 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              {/* Search Bar */}
              <div className="relative group flex-1 max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm"
                />
              </div>

              {/* Category Filter */}
              <CustomSelect
                value={selectedCategory}
                onChange={setSelectedCategory}
                options={[
                  { label: "All Categories", value: "all" },
                  { label: "Marketing", value: "marketing" },
                  { label: "Utility", value: "utility" },
                ]}
              />

              {/* Language Filter */}
              <CustomSelect
                value={selectedLanguage}
                onChange={setSelectedLanguage}
                options={[
                  { label: "All Languages", value: "all" },
                  { label: "English", value: "en" },
                  { label: "Hindi", value: "hi" },
                  { label: "Gujarati", value: "gu" },
                ]}
              />

              {/* Type Filter */}
              <CustomSelect
                value={selectedType}
                onChange={setSelectedType}
                options={[
                  { label: "All Types", value: "all" },
                  { label: "Text Only", value: "text" },
                  { label: "With Image", value: "image" },
                  { label: "With Action", value: "action" },
                ]}
              />

              {/* Reset Button */}
              {(searchQuery || selectedCategory !== "all" || selectedLanguage !== "all" || selectedType !== "all" || activeTab !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                    setSelectedLanguage("all");
                    setSelectedType("all");
                    setActiveTab("all");
                  }}
                  className="w-9 h-9 flex items-center justify-center bg-white border border-rose-100 text-rose-500 hover:bg-rose-50 rounded-lg transition-all shadow-sm active:scale-95 group"
                  title="Reset All Filters"
                >
                  <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={syncWithMeta}
                disabled={syncing}
                className="inline-flex items-center gap-2 h-9 px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-lg transition-all shadow-sm disabled:opacity-50 active:scale-95"
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <RefreshCw className="w-4 h-4 text-blue-600" />}
                <span>{syncing ? "Syncing..." : "Sync with Meta"}</span>
              </button>
              <button
                onClick={() => navigate("/templates/create")}
                className="inline-flex items-center gap-2 h-9 px-4 bg-blue-600 text-white hover:bg-blue-700 shadow-sm text-xs font-bold rounded-lg transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Create Template</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4 border-b border-slate-200">
            {["all", "approved", "pending"].map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={cn(
                  "relative pb-2.5 px-1 text-sm font-bold transition-all",
                  activeTab === t ? "text-blue-600" : "text-slate-400 hover:text-slate-900"
                )}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {activeTab === t && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content View (List or Create/Edit) */}
      <div className="flex-1 overflow-hidden px-5 pb-5">
        {mode === "list" ? (
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
                    localStorage.setItem("templates_density", val);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto custom-scrollbar">
              {paginatedTemplates.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 transition-transform hover:scale-110">
                    <MessageSquare className="w-8 h-8 text-slate-200" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">No blueprints found</h3>
                  <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                    {searchQuery ? "Try refining your search terms." : "Start by creating your first WhatsApp template concept."}
                  </p>
                </div>
              ) : (
                <table className="w-full border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50/80 backdrop-blur-sm shadow-sm ring-1 ring-slate-200/20">
                      <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Definition</th>
                      <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Category</th>
                      <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Format</th>
                      <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Meta Status</th>
                      <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Locale</th>
                      <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Sample</th>
                      <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Created</th>
                      <th className="px-5 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedTemplates.map((t) => (
                      <tr
                        key={t._id}
                        className="group hover:bg-blue-50/20 transition-all duration-200 cursor-pointer"
                        onClick={(e) => {
                          if (e.target.closest('button')) return;
                          const mapped = { ...t, header: t.header?.type === "image" ? { type: "image", image: t.header.image, preview: getImageUrl(t.header.image) } : (t.header || { type: "none" }), variableValues: {} };
                          setPreviewTemplate(mapped);
                        }}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100/50 group-hover:bg-white group-hover:border-blue-200 group-hover:shadow-sm text-slate-400 group-hover:text-blue-600 flex items-center justify-center shrink-0 transition-all">
                              <MessageSquare className="w-4.5 h-4.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 text-sm truncate group-hover:text-blue-700">{t.name}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">ID_{t._id.slice(-8).toUpperCase()}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border",
                            t.category === "MARKETING" ? "bg-purple-50 text-purple-700 border-purple-100" :
                              t.category === "AUTHENTICATION" ? "bg-amber-50 text-amber-700 border-amber-100" :
                                "bg-blue-50 text-blue-700 border-blue-100"
                          )}>
                            {t.category || "UTILITY"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {t.header?.type === "image" ? "IMAGE" : t.buttons?.length > 0 ? "ACTION" : "TEXT"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-xs",
                            t.metaStatus === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-100/50" :
                              t.metaStatus === "pending" ? "bg-amber-50 text-amber-700 border-amber-100/50" :
                                "bg-slate-50 text-slate-600 border-slate-100"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full shadow-sm",
                              t.metaStatus === "approved" ? "bg-emerald-500" :
                                t.metaStatus === "pending" ? "bg-amber-500 animate-pulse" : "bg-slate-400"
                            )} />
                            {t.metaStatus ? t.metaStatus.charAt(0).toUpperCase() + t.metaStatus.slice(1) : "Draft"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] grayscale-[0.2] group-hover:grayscale-0 transition-all">
                              {t.language?.includes('hi') || t.language?.includes('gu') ? "🇮🇳" : "🇺🇸"}
                            </span>
                            <span className="text-[11px] font-bold text-slate-600 uppercase">{t.language?.split('_')[0] || t.language}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 overflow-hidden">
                          <div className="text-slate-500 text-[11px] font-medium leading-relaxed truncate max-w-[200px] italic">
                            "{t.body?.substring(0, 60)}..."
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "-"}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right w-48">
                          <div className="flex items-center justify-end gap-3 transition-all">
                            {(!t.metaStatus || t.metaStatus === "draft") && (
                              <button
                                onClick={() => submitToMeta(t._id)}
                                disabled={submittingId === t._id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                title="Submit to Meta for Approval"
                              >
                                {submittingId === t._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                {submittingId === t._id ? "Submitting" : "Submit"}
                              </button>
                            )}
                            <div className="flex items-center gap-1.5">
                              {(!t.metaStatus || t.metaStatus === "draft" || t.metaStatus === "pending") && (
                                <button
                                  onClick={() => navigate(`/templates/edit/${t._id}`)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100"
                                  title="Edit Concept"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  const mapped = { ...t, header: t.header?.type === "image" ? { type: "image", image: t.header.image, preview: getImageUrl(t.header.image) } : (t.header || { type: "none" }), variableValues: {} };
                                  setPreviewTemplate(mapped);
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all border border-transparent hover:border-slate-200"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteTemplate(t)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100"
                                title="Delete Template"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Viewing <span className="text-blue-600 font-bold">{startIndex + 1}-{Math.min(startIndex + itemsPerPage, searchedTemplates.length)}</span> of {searchedTemplates.length} Registry Entries
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-3 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                >
                  Prev
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                    const pNum = i + 1;
                    return (
                      <button
                        key={pNum}
                        onClick={() => setCurrentPage(pNum)}
                        className={cn(
                          "w-8 h-8 text-[11px] font-bold rounded-lg transition-all",
                          currentPage === pNum ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-white border border-slate-200 text-slate-500 hover:border-blue-200"
                        )}
                      >
                        {pNum}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-3 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* CREATE / EDIT UI - TWO COLUMN LAYOUT WITH LIGHT/CLEAN PREVIEW */
          <div className="h-full grid grid-cols-1 xl:grid-cols-12 gap-5 overflow-hidden pt-4">
            <div className="xl:col-span-8 h-full flex flex-col overflow-hidden">
              <div className="flex-1 bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                {/* Card Header (Replaces Blueprint Editor header with Page Header) */}
                <div className="p-5 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => navigate("/templates")}
                      className="w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all shadow-sm group"
                    >
                      <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
                    </button>
                    <div>
                      <h1 className="text-base font-bold text-slate-900 font-poppins leading-none tracking-tight">
                        {mode === "create" ? "Create Template" : "Edit Template"}
                      </h1>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Draft Concept • Meta Standard
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-slate-50/30">
                  <TemplateForm
                    form={form}
                    setForm={setForm}
                    onSubmit={mode === "create" ? createTemplate : updateTemplate}
                    isSubmitting={saving}
                  />
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 h-full hidden xl:flex flex-col">
              <div className="flex-1 bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col">
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Real-time Dispatch Preview</span>
                    </div>
                    <div className="px-2 py-0.5 bg-slate-50 border border-slate-100/50 rounded-full text-[8px] font-black text-slate-400 uppercase tracking-tight">
                      Preview Engine 2.1
                    </div>
                  </div>

                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-full max-w-[320px] transform scale-[0.95] origin-center">
                      <TemplatePreview
                        headerType={form.header?.type || 'none'}
                        headerText={form.header?.text || ''}
                        headerImage={form.header?.preview || ''}
                        bodyText={form.body || ''}
                        footer={form.footer || ''}
                        buttons={form.buttons || []}
                        variableValues={form.variableValues || {}}
                      />
                    </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100/50 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Info className="w-4 h-4 text-blue-500" />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                        Meta review typically completes in <span className="text-slate-900 font-bold">2-4 hours</span>. Ensure content complies with Commerce Policies.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 📋 TEMPLATE PREVIEW MODAL */}
      {/* 📋 TEMPLATE PREVIEW MODAL - SYNCED WITH SYSTEM DESIGN */}
      {previewTemplate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[80vh] overflow-hidden border border-slate-200/50 animate-in zoom-in-95 duration-300">
            {/* Corner Close Button */}
            <button
              onClick={() => setPreviewTemplate(null)}
              className="absolute top-4 right-4 z-[120] w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white text-slate-400 hover:text-red-500 rounded-full transition-all shadow-sm border border-slate-100/50 backdrop-blur-sm"
              title="Close Preview"
            >
              <X size={20} strokeWidth={2.5} />
            </button>

            <div className="flex flex-col lg:flex-row h-full">
              {/* 📝 LEFT: DETAILS & CONTENT (WITH STICKY HEADER/FOOTER) */}
              <div className="flex-1 flex flex-col h-full bg-white border-r border-slate-100 min-w-0">

                <div className="px-6 py-5 border-b border-slate-100/60 flex items-center justify-between bg-white/90 backdrop-blur-xl z-10 sticky top-0">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100/50 shadow-sm shadow-indigo-100/20">
                      <Eye size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight font-outfit">Template Details</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 leading-none font-poppins">Ref: {previewTemplate._id?.slice(-8).toUpperCase() || "PREVIEW"}</p>
                    </div>
                  </div>
                </div>

                {/* SCROLLABLE CONTENT AREA */}
                <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 bg-slate-50/30 custom-scrollbar">
                  
                  {/* Metadata Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white border border-slate-100/80 shadow-sm shadow-slate-100/50 group hover:border-indigo-200 transition-colors">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-poppins">Asset Classification</p>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full",
                          previewTemplate.category === "MARKETING" ? "bg-purple-500" :
                          previewTemplate.category === "AUTHENTICATION" ? "bg-amber-500" :
                          "bg-indigo-500"
                        )} />
                        <span className="text-[13px] font-bold text-slate-700 capitalize font-inter">
                          {previewTemplate.category?.toLowerCase() || 'Utility'}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-slate-100/80 shadow-sm shadow-slate-100/50 group hover:border-indigo-200 transition-colors">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-poppins">Registration Date</p>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <p className="text-[13px] font-bold text-slate-700 font-inter">
                          {previewTemplate.createdAt ? new Date(previewTemplate.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Draft'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {previewTemplate.header?.type === 'image' && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-poppins pl-1">Header Asset</p>
                      <div className="rounded-2xl border border-slate-200/60 overflow-hidden bg-white shadow-md shadow-slate-200/20 group relative p-1.5">
                        <img
                          src={getImageUrl(previewTemplate.header.image)}
                          alt="Preview"
                          className="w-full h-auto max-h-[220px] object-cover rounded-xl"
                          onError={(e) => { e.target.src = 'https://via.placeholder.com/800x400?text=Asset+Not+Found'; }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-poppins pl-1">Message Content</p>
                    <div className="p-6 rounded-3xl bg-white border border-slate-100/80 text-[14px] text-slate-700 font-medium leading-relaxed whitespace-pre-wrap shadow-sm shadow-slate-100/50 italic font-inter">
                      "{previewTemplate.body || "No blueprint content available"}"
                    </div>
                  </div>

                  {previewTemplate.footer && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-poppins pl-1">Footnote</p>
                      <div className="inline-block px-4 py-2.5 bg-white rounded-xl text-[12px] font-medium text-slate-500 italic border border-slate-100/80 shadow-sm">
                        {previewTemplate.footer}
                      </div>
                    </div>
                  )}

                  {(previewTemplate.body?.match(/{{\d+}}/g) || []).length > 0 && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-poppins pl-1">Interactive Triggers</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(previewTemplate.body.match(/{{\d+}}/g) || []).map(v => (
                          <div key={v} className="bg-white p-3 rounded-2xl border border-slate-200/60 shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50">
                            <label className="text-[9px] font-black text-indigo-500 uppercase pl-1 block mb-1 font-poppins">{v} Token</label>
                            <input
                              className="w-full h-8 text-[12px] font-medium text-slate-800 focus:outline-none placeholder:text-slate-300 bg-transparent px-1 font-inter"
                              placeholder={`Simulate ${v}...`}
                              value={previewTemplate.variableValues?.[v] || ""}
                              onChange={(e) => {
                                setPreviewTemplate(prev => ({
                                  ...prev,
                                  variableValues: { ...prev.variableValues, [v]: e.target.value }
                                }));
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* STICKY MODAL FOOTER */}
                <div className="px-6 py-5 border-t border-slate-100/80 flex items-center justify-end gap-3 bg-white/90 backdrop-blur-xl z-10 sticky bottom-0">
                  <button
                    onClick={() => setPreviewTemplate(null)}
                    className="px-5 py-2.5 text-[11px] font-bold text-slate-400 hover:text-slate-700 transition-colors uppercase tracking-widest font-poppins"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => {
                      setForm({
                        name: `${previewTemplate.name}_copy`,
                        category: previewTemplate.category || "UTILITY",
                        language: previewTemplate.language || "en_US",
                        header: previewTemplate.header || { type: "none" },
                        body: previewTemplate.body || "",
                        footer: previewTemplate.footer || "",
                        buttons: previewTemplate.buttons || [],
                      });
                      navigate("/templates/create");
                      setPreviewTemplate(null);
                    }}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 uppercase tracking-widest flex items-center gap-2 font-poppins"
                  >
                    <Plus size={14} strokeWidth={3} />
                    Modify Asset
                  </button>
                </div>
              </div>

              {/* 📱 RIGHT: PHONE PREVIEW - STICKY PREVIEW AREA */}
              <div className="bg-slate-50/50 lg:w-[420px] shrink-0 p-6 flex flex-col items-center justify-center border-l border-slate-100 relative group overflow-hidden">
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
                      headerType={previewTemplate.header?.type || 'none'}
                      headerText={previewTemplate.header?.text || ''}
                      headerImage={previewTemplate.header?.image || previewTemplate.header_image || previewTemplate.media_url || ''}
                      bodyText={previewTemplate.body || previewTemplate.message || previewTemplate.text || ''}
                      footer={previewTemplate.footer || ''}
                      buttons={previewTemplate.buttons || []}
                      variableValues={previewTemplate.variableValues || {}}
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
