import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, FileText, Globe, Phone, MessageSquare, Tag,
  AlertCircle, CheckCircle2, Loader2, Image as ImageIcon, X, Upload, ChevronDown,
  Layers, Settings, Layout, MousePointer2, Info, ArrowLeft
} from "lucide-react";
import { useIntegration } from "../../context/IntegrationContext";
import api from "../../api/api";
import { getImageUrl } from "../../utils/imageHelpers";

export default function TemplateForm({ form, setForm, onSubmit, isSubmitting = false }) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [imageError, setImageError] = useState(null);
  const [variableError, setVariableError] = useState(null);
  const [ratioError, setRatioError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMethod, setUploadMethod] = useState("upload");

  const { catalogConnected } = useIntegration();

  const cn = (...classes) => classes.filter(Boolean).join(" ");

  // Custom dropdown component
  const CustomDropdown = ({ value, onChange, options, placeholder, className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full h-9 px-3 bg-white border border-slate-200 rounded-lg
                   text-slate-900 font-medium transition-colors
                   hover:border-slate-300
                   flex items-center justify-between text-left group ${className}`}
        >
          <span className={value ? "text-slate-900" : "text-slate-400"}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-[9999] w-full mt-2 bg-white border border-slate-200 rounded-[12px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-1 max-h-64 overflow-y-auto custom-scrollbar">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm rounded-lg transition-all duration-150 mb-0.5 last:mb-0
                           hover:bg-blue-50 hover:text-blue-700
                           ${value === option.value ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 font-medium'}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{option.label}</span>
                    {value === option.value && (
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0px_4px_12px_rgba(0,0,0,0.05)] shadow-blue-500/50"></div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ================= VARIABLE DETECTION ================= */
  const variables = useMemo(() => {
    const matches = form.body?.match(/{{\d+}}/g) || [];
    return [...new Set(matches)];
  }, [form.body]);

  /* ================= VARIABLE SEQUENCE VALIDATION ================= */
  const validateVariableSequence = (bodyText) => {
    const matches = bodyText?.match(/{{\d+}}/g) || [];
    if (matches.length === 0) return { isValid: true, error: null };

    const numbers = matches.map(match => parseInt(match.match(/\d+/)[0]));
    const maxNumber = Math.max(...numbers);

    for (let i = 1; i <= maxNumber; i++) {
      if (!numbers.includes(i)) {
        return {
          isValid: false,
          error: `Variables must be sequential. You are missing {{${i}}} but used higher numbers. Please use variables in 1, 2, 3... order.`
        };
      }
    }

    return { isValid: true, error: null };
  };

  /* ================= REAL-TIME VALIDATION ================= */
  useEffect(() => {
    const validation = validateVariableSequence(form.body);
    setVariableError(validation.error);

    const variables = form.body?.match(/{{\d+}}/g) || [];
    const bodyTextLength = form.body?.replace(/{{\d+}}/g, '').trim().length || 0;
    if (variables.length > 0 && bodyTextLength < variables.length * 10) {
      setRatioError(`Body text is too short. WhatsApp requires about 10 characters per variable.`);
    } else {
      setRatioError(null);
    }
  }, [form.body]);

  /* ================= SYNC VARIABLE VALUES ================= */
  useEffect(() => {
    if (!variables.length) {
      if (form.variableValues) {
        setForm((prev) => ({ ...prev, variableValues: {} }));
      }
      return;
    }

    const map = {};
    variables.forEach((v) => {
      map[v] = form.variableValues?.[v] || "";
    });

    setForm((prev) => ({
      ...prev,
      variableValues: map,
    }));
  }, [variables]);

  /* ================= IMAGE FILE VALIDATION ================= */
  const validateAndSetImage = (file) => {
    setImageError(null);

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setImageError("Format not supported. Use JPG, PNG, or WEBP.");
      return false;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setImageError("Image is too large. Max size is 5MB.");
      return false;
    }

    // Start upload immediately
    uploadImage(file);
    return true;
  };

  const uploadImage = async (file) => {
    setIsUploading(true);
    setImageError(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await api.post("/upload/template-image", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (response.data.success) {
        setForm((prev) => ({
          ...prev,
          header: {
            ...prev.header,
            type: "image",
            image: response.data.imageUrl,
            preview: response.data.imageUrl
          }
        }));
      } else {
        setImageError("Upload failed. Please try again.");
      }
    } catch (error) {
      console.error("Upload Error:", error);
      setImageError(error.response?.data?.error || "Failed to upload image.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetImage(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetImage(file);
  };

  const handleRemoveImage = () => {
    if (form.header?.preview && form.header.preview.startsWith('blob:')) {
      URL.revokeObjectURL(form.header.preview);
    }
    setForm((prev) => ({
      ...prev,
      header: { type: "image" },
    }));
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleHeaderTypeChange = (newType) => {
    if (form.header?.type === "image" && form.header?.preview) {
      URL.revokeObjectURL(form.header.preview);
    }
    setForm((prev) => ({
      ...prev,
      header: { type: newType },
    }));
    setImageError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateVariableSequence(form.body);
    if (!validation.isValid) {
      setVariableError(validation.error);
      return;
    }
    onSubmit();
  };

  const addVariable = () => {
    const matches = form.body?.match(/{{\d+}}/g) || [];
    const numbers = matches.map(match => parseInt(match.match(/\d+/)[0]));
    const nextVar = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;

    setForm(prev => ({
      ...prev,
      body: (prev.body || "") + `{{${nextVar}}}`
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-10">
      {/* ================= SECTION 1: CORE INFO ================= */}
      <div className="relative z-30 rounded-2xl bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8">
        <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-20"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 flex items-center justify-center shadow-inner">
              <Layout className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">Template Identity</h3>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Core settings</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2.5 relative group">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-hover:text-blue-500">Language</label>
            <CustomDropdown
              value={form.language}
              onChange={(value) => setForm({ ...form, language: value })}
              options={[
                { value: "en_US", label: "English (US)" },
                { value: "hi_IN", label: "Hindi" },
                { value: "gu_IN", label: "Gujarati" }
              ]}
              placeholder="Select language"
              className="h-11 rounded-xl bg-slate-50/50 border-slate-200/60 shadow-sm hover:bg-white focus:bg-white"
            />
          </div>

          <div className="space-y-2.5 relative group">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-hover:text-blue-500">Template Name</label>
            <div className="relative">
              <input
                className="w-full h-11 px-4 bg-slate-50/50 border border-slate-200/60 rounded-xl text-slate-900 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white hover:bg-white transition-all shadow-sm"
                placeholder="e.g. shipping_update"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight ml-1 absolute -bottom-5 left-0">Lowercase & underscores only</p>
          </div>

          <div className="space-y-2.5 relative group">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-hover:text-blue-500">Category</label>
            <CustomDropdown
              value={form.category}
              onChange={(value) => setForm({ ...form, category: value })}
              options={[
                { value: "UTILITY", label: "Utility (Order Updates)" },
                { value: "MARKETING", label: "Marketing (Promotions)" }
              ]}
              placeholder="Select category"
              className="h-11 rounded-xl bg-slate-50/50 border-slate-200/60 shadow-sm hover:bg-white focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* ================= SECTION 2: CONTENT ================= */}
      <div className="relative z-20 rounded-2xl bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8">
        <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-20"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/50 flex items-center justify-center shadow-inner">
              <MessageSquare className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">Message Content</h3>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Craft content & variables</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* HEADER SECTION - INNER CARD */}
          <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-slate-50/80">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                <Layers className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <h4 className="text-[13px] font-bold text-slate-800 tracking-tight">Header</h4>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Optional</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              {[
                { id: "none", label: "None", icon: null },
                { id: "text", label: "Text", icon: FileText },
                { id: "image", label: "Image", icon: ImageIcon }
              ].map((opt) => {
                const Icon = opt.icon;
                const isActive = form.header.type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleHeaderTypeChange(opt.id)}
                    className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl border transition-all font-bold text-sm ${isActive ? "bg-teal-50 border-teal-200 text-teal-600 shadow-sm" : "bg-white border-slate-200/60 text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {form.header.type === "text" && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <input
                  className="w-full h-11 px-4 bg-white border border-slate-200/60 rounded-xl text-slate-900 text-sm font-bold focus:border-teal-500 outline-none transition-all shadow-sm"
                  placeholder="Enter header text (e.g., Order Update)"
                  value={form.header.text || ""}
                  onChange={(e) => setForm({ ...form, header: { ...form.header, text: e.target.value } })}
                />
              </div>
            )}

          {form.header.type === "image" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex gap-2 mb-2">
                {[
                  { id: "upload", label: "Upload" },
                  { id: "url", label: "URL" }
                ].map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setUploadMethod(method.id)}
                    className={cn(
                      "px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                      uploadMethod === method.id
                        ? "bg-slate-100 border border-slate-200 text-slate-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {method.label}
                  </button>
                ))}
              </div>

              {uploadMethod === "upload" ? (
                <>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  {!form.header?.preview && !isUploading ? (
                    <div
                      onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group flex flex-col items-center justify-center gap-2 ${dragActive ? "border-blue-500 bg-blue-50" : "border-slate-100 hover:border-blue-300 bg-slate-50/30"}`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-all border border-slate-100">
                        <ImageIcon className="w-6 h-6 text-slate-200 group-hover:text-blue-500 transition-colors" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-tight">Upload Asset</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">Max 5MB (PNG/JPG)</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm p-2 group">
                      {isUploading ? (
                        <div className="w-full h-40 flex flex-col items-center justify-center bg-slate-50 rounded-lg">
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processing...</p>
                        </div>
                      ) : (
                        <>
                          <img src={getImageUrl(form.header.preview)} className="w-full h-48 object-cover rounded-[18px]" />
                          <button type="button" onClick={handleRemoveImage} className="absolute top-6 right-6 w-10 h-10 bg-black/60 backdrop-blur-md text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600">
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Direct Asset Link</label>
                    <input
                      className="w-full h-10 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:border-blue-500 outline-none transition-all shadow-sm"
                      placeholder="https://example.com/image.jpg"
                      value={form.header.image || ""}
                      onChange={(e) => setForm({
                        ...form,
                        header: {
                          ...form.header,
                          type: "image",
                          image: e.target.value,
                          preview: e.target.value
                        }
                      })}
                    />
                  </div>
                  {form.header.preview && (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm p-2 group">
                      <img src={getImageUrl(form.header.preview)} className="w-full h-48 object-cover rounded-[18px]" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, header: { ...form.header, image: "", preview: "" } })}
                        className="absolute top-6 right-6 w-10 h-10 bg-black/60 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

          {/* MESSAGE BODY - INNER CARD */}
          <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-slate-50/80">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                    <MessageSquare className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[13px] font-bold text-slate-800 tracking-tight">Message Body</label>
                    <div className="px-2 py-0.5 bg-teal-500/10 text-teal-600 text-[9px] font-black rounded uppercase tracking-widest border border-teal-100/50">Primary</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addVariable}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-teal-200 hover:border-teal-400 hover:bg-teal-50 text-teal-600 text-[11px] font-bold rounded-xl transition-all shadow-sm active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                  Add Variable
                </button>
              </div>
              
              <div className="relative group">
                <textarea
                  rows={5}
                  className="w-full px-5 py-4 border border-slate-200/60 rounded-xl bg-white text-slate-900 text-sm font-medium outline-none focus:border-teal-500 transition-all resize-none leading-relaxed placeholder-slate-300"
                  placeholder="Hi {{1}}, your package {{2}} is ready for pickup!"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2 px-1">
                <Tag className="w-3.5 h-3.5 text-teal-500" />
                <p className="text-[11px] text-slate-500 font-bold">
                  Variables: <code className="bg-teal-50 border border-teal-100 text-teal-700 px-1.5 py-0.5 rounded ml-1 text-[10px] font-bold">{"{{1}}"}</code>, <code className="bg-teal-50 border border-teal-100 text-teal-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{"{{2}}"}</code>
                </p>
              </div>

              {(variableError || ratioError) && (
                <div className="mt-4 p-5 bg-red-50/80 border border-red-200 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top-4 duration-500 shadow-sm backdrop-blur-sm">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-red-100 shrink-0 shadow-sm">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="space-y-1 pt-0.5">
                    <p className="text-[13px] font-extrabold text-red-800 tracking-tight">{variableError ? "Variable Error" : "Character Ratio Error"}</p>
                    <p className="text-[12px] font-medium text-red-600/90 leading-relaxed">
                      {variableError || ratioError}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* FOOTER - INNER CARD */}
          <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-slate-50/80">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-bold text-slate-800 tracking-tight">Footer Text</label>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Optional</span>
              </div>
              <input
                className="w-full h-11 px-4 border border-slate-200/60 rounded-xl text-slate-900 text-sm font-bold focus:border-teal-500 outline-none transition-all placeholder-slate-300 shadow-sm"
                placeholder="e.g. Zepofy Team"
                value={form.footer}
                onChange={(e) => setForm({ ...form, footer: e.target.value })}
              />
            </div>
          </div>

          {/* 🔥 NEW SECTION: VARIABLE VALUES 🔥 */}
          {variables.length > 0 && (
            <div className="p-6 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-2xl border border-indigo-100/50 shadow-sm transition-all animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 bg-white rounded-[12px] flex items-center justify-center border border-indigo-100/50 shadow-sm">
                  <Tag className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h4 className="text-[15px] font-extrabold text-slate-900 tracking-tight">Variable Values</h4>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Preview values for testing</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {variables.sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0])).map((v) => (
                  <div key={v} className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-900/60 uppercase tracking-widest pl-1 transition-colors hover:text-indigo-600">Value for {v}</label>
                    <input
                      className="w-full h-11 px-4 bg-white border border-indigo-100 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all shadow-sm"
                      placeholder={`Enter value for ${v}`}
                      value={form.variableValues?.[v] || ""}
                      onChange={(e) => {
                        setForm(prev => ({
                          ...prev,
                          variableValues: {
                            ...prev.variableValues,
                            [v]: e.target.value
                          }
                        }));
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= SECTION 3: BUTTONS ================= */}
      <div className="relative z-10 rounded-2xl bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8">
        <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 opacity-20"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-100/50 flex items-center justify-center shadow-inner">
              <MousePointer2 className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">Interactive Controls</h3>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Add CTAs (Max 2)</p>
            </div>
          </div>
          {form.buttons.length < 2 && (
            <button
              type="button"
              onClick={() => setForm({ ...form, buttons: [...form.buttons, { type: "URL", text: "", url: "", phone: "" }] })}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition-all cursor-pointer shadow-md shadow-blue-500/10 active:scale-95 uppercase tracking-wider"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5 inline" strokeWidth={3} /> Add Control
            </button>
          )}
        </div>

          {form.buttons.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border-2 border-dashed border-slate-200/50 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <div className="w-16 h-16 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-sm border border-slate-100">
                <MousePointer2 className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-[13px] font-extrabold text-slate-500 uppercase tracking-widest">Interactive elements</p>
              <p className="text-[11px] text-slate-400 font-bold mt-1.5">Connect with Quick Replies or Website links</p>
            </div>
          ) : (
            <div className="space-y-4">
              {form.buttons.map((b, i) => (
                <div key={i} className="group relative bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] transition-all hover:border-violet-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <button
                    type="button"
                    onClick={() => {
                      const copy = [...form.buttons];
                      copy.splice(i, 1);
                      setForm({ ...form, buttons: copy });
                    }}
                    className="absolute -top-3 -right-3 w-8 h-8 bg-white border border-slate-200 text-slate-400 
                             hover:text-red-500 hover:border-red-200 hover:bg-red-50 rounded-full flex items-center justify-center 
                             shadow-md transition-all z-[100]"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2 relative group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 transition-colors group-hover:text-violet-500">Action Type</label>
                        <CustomDropdown
                          value={b.type}
                          onChange={(value) => {
                            const copy = [...form.buttons];
                            copy[i] = { type: value, text: value === "CATALOG" ? "View catalog" : "", url: "", phone: "" };
                            setForm({ ...form, buttons: copy });
                          }}
                          options={[
                            { value: "URL", label: "Visit Website" },
                            { value: "PHONE_NUMBER", label: "Call Phone" },
                            ...(catalogConnected ? [{ value: "CATALOG", label: "View Catalog" }] : [])
                          ]}
                          className="h-11 rounded-xl bg-slate-50/50 hover:bg-white focus:bg-white border-slate-200/60 shadow-sm"
                        />
                      </div>

                      <div className="space-y-2 relative group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 transition-colors group-hover:text-violet-500">Button Text</label>
                        <input
                          className="w-full h-11 px-4 bg-slate-50/50 border border-slate-200/60 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-violet-500 focus:bg-white hover:bg-white transition-all shadow-sm"
                          placeholder="e.g. Visit Website"
                          value={b.text}
                          onChange={(e) => {
                            const copy = [...form.buttons];
                            copy[i].text = e.target.value;
                            setForm({ ...form, buttons: copy });
                          }}
                        />
                      </div>
                    </div>

                    {b.type !== "CATALOG" && (
                      <div className="space-y-2 relative group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 transition-colors group-hover:text-violet-500">
                          {b.type === "URL" ? "Target Link" : "Target Phone"}
                        </label>
                        <input
                          className="w-full h-11 px-4 bg-slate-50/50 border border-slate-200/60 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-violet-500 focus:bg-white hover:bg-white transition-all shadow-sm"
                          placeholder={b.type === "URL" ? "https://..." : "+91..."}
                          value={b.type === "URL" ? (b.url || "") : (b.phone || "")}
                          onChange={(e) => {
                            const copy = [...form.buttons];
                            if (b.type === "URL") copy[i].url = e.target.value;
                            else copy[i].phone = e.target.value;
                            setForm({ ...form, buttons: copy });
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* ================= FINAL ACTIONS ================= */}
      <div className="flex items-center justify-end gap-4 pt-8 pb-4">
        <button
          type="submit"
          disabled={isSubmitting || isUploading || variableError || imageError || ratioError}
          className="w-full sm:w-auto px-12 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-[13px] uppercase tracking-widest
           shadow-[0_8px_20px_rgb(79,70,229,0.25)] transition-all hover:shadow-[0_8px_25px_rgb(79,70,229,0.35)] hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-3 border border-indigo-500/50"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
          <span>{isSubmitting ? "Submitting..." : (isUploading ? "Uploading..." : "Save Template Settings")}</span>
        </button>
      </div>
    </form>
  );
}
