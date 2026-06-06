import { useRef, useState, useEffect } from "react";
import {
    Plus, MessageSquare, ImageIcon, X, Upload,
    Settings, Layout, MousePointer2, CheckCircle2, Loader2,
    ChevronDown, Terminal, Image as LuImage, Sparkles, Check, Layers, PanelsTopLeft
} from "lucide-react";
import api from "../../api/api";
import { getImageUrl } from "../../utils/imageHelpers";
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function SystemTemplateForm({ form, setForm, onSubmit, isSubmitting = false }) {
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [uploadMethod, setUploadMethod] = useState("upload");

    // Custom premium dropdown component
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
                    <span className={value ? "text-slate-900 uppercase tracking-tight" : "text-slate-400"}>
                        {selectedOption?.label || placeholder}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute z-[100] w-full mt-2 bg-white border border-slate-100 rounded-[22px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full px-4 py-3 text-left text-[11px] rounded-[14px] transition-all duration-150 mb-0.5 last:mb-0 uppercase tracking-widest
                                             hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between
                                             ${value === option.value ? 'bg-blue-50/50 text-blue-700 font-black' : 'text-slate-600 font-bold'}`}
                                >
                                    <span>{option.label}</span>
                                    {value === option.value && (
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-sm"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const handleImageUpload = async (file) => {
        setIsUploading(true);
        setUploadError(null);
        const formData = new FormData();
        formData.append("image", file);
        try {
            const res = await api.post("/upload/template-image", formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            if (res.data.success) {
                setForm({ ...form, imageUrl: res.data.imageUrl, type: 'media' });
            }
        } catch (err) {
            setUploadError("Protocol Rejection: Network failure or invalid asset.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddButton = () => {
        if (form.buttons.length >= 3) return;
        setForm({
            ...form,
            buttons: [...form.buttons, { label: "", actionType: "reply", value: "" }]
        });
    };

    const removeButton = (index) => {
        const copy = [...form.buttons];
        copy.splice(index, 1);
        setForm({ ...form, buttons: copy });
    };

    return (
        <form className="space-y-6 sm:space-y-10" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>

            {/* ================= SECTION 1: CORE INFO ================= */}
            <div className="relative z-30 rounded-2xl bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8">
                <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-20"></div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 flex items-center justify-center shadow-inner">
                            <Sparkles className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-extrabold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">System Identification</h3>
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Official Registry</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2.5 relative group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-hover:text-blue-500">Unique Identifier</label>
                        <input
                            className="w-full h-11 px-4 bg-slate-50/50 border border-slate-200/60 rounded-xl
                                text-slate-900 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white hover:bg-white transition-all shadow-sm"
                            placeholder="e.g. system_onboarding"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2.5 relative group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-hover:text-blue-500">Payload Type</label>
                        <CustomDropdown
                            value={form.type}
                            onChange={(value) => setForm({ ...form, type: value })}
                            options={[
                                { value: "text", label: "Linear Data (Text Only)" },
                                { value: "media", label: "Visual Segment (Image + Text)" }
                            ]}
                            placeholder="Select payload type"
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
                            <Terminal className="w-6 h-6 text-teal-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-extrabold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">Content Architecture</h3>
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Payload & Assets</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Media section */}
                    {form.type === 'media' && (
                        <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-slate-50/80 animate-in fade-in duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                                    <LuImage className="w-4 h-4 text-slate-500" />
                                </div>
                                <div>
                                    <h4 className="text-[13px] font-bold text-slate-800 tracking-tight">Visual Asset</h4>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Required for media type</p>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
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
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload(e.target.files[0])}
                                        />

                                        {form.imageUrl && !isUploading ? (
                                            <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white p-2 shadow-sm">
                                                <img src={getImageUrl(form.imageUrl)} className="w-full h-48 object-cover rounded-[18px]" />
                                                <button
                                                    type="button"
                                                    onClick={() => setForm({ ...form, imageUrl: "" })}
                                                    className="absolute top-6 right-6 w-10 h-10 bg-black/60 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() => !isUploading && fileInputRef.current.click()}
                                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group flex flex-col items-center justify-center gap-2 border-slate-100 hover:border-blue-300 bg-slate-50/30`}
                                            >
                                                {isUploading ? (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processing...</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                                                            <LuImage className="w-6 h-6 text-slate-200 group-hover:text-blue-500" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs font-bold text-slate-700 uppercase tracking-tight">Upload Asset</p>
                                                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">MAX 5MB (PNG/JPG)</p>
                                                        </div>
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
                                                placeholder="https://example.com/asset.jpg"
                                                value={form.imageUrl || ""}
                                                onChange={(e) => setForm({ ...form, imageUrl: e.target.value, type: 'media' })}
                                            />
                                        </div>
                                        {form.imageUrl && (
                                            <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white p-2 shadow-sm">
                                                <img src={getImageUrl(form.imageUrl)} className="w-full h-48 object-cover rounded-[18px]" />
                                                <button
                                                    type="button"
                                                    onClick={() => setForm({ ...form, imageUrl: "" })}
                                                    className="absolute top-6 right-6 w-10 h-10 bg-black/60 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-all"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {uploadError && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-2 flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> {uploadError}</p>}
                            </div>
                        </div>
                    )}

                    <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-slate-50/80">
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                                        <MessageSquare className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-[13px] font-bold text-slate-800 tracking-tight">Message Payload</h4>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Required</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="relative group mt-4">
                                <textarea
                                    className="w-full h-32 p-5 bg-white border border-slate-200/60 rounded-xl 
                                     text-slate-900 text-sm font-medium leading-relaxed resize-none
                                     focus:border-teal-500 outline-none transition-all shadow-sm"
                                    placeholder="Simulation: Welcome to Zepofy, {{1}}..."
                                    value={form.message}
                                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ================= SECTION 3: BUTTONS ================= */}
            <div className="relative z-10 rounded-2xl bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8">
                <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 opacity-20"></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-50 to-pink-50 border border-violet-100/50 flex items-center justify-center shadow-inner">
                            <MousePointer2 className="w-6 h-6 text-fuchsia-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-extrabold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">Interactive Triggers</h3>
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">CTA Nodes (Max 3)</p>
                        </div>
                    </div>
                    {form.buttons.length < 3 && (
                        <button
                            type="button"
                            onClick={handleAddButton}
                            className="group relative flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                            <Plus className="w-4 h-4" />
                            <span className="uppercase tracking-widest">Add Node</span>
                        </button>
                    )}
                </div>

                <div className="space-y-6">
                    {form.buttons.length === 0 ? (
                        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 flex flex-col items-center justify-center text-center transition-all hover:bg-slate-50 hover:border-violet-200">
                            <MousePointer2 className="w-10 h-10 text-slate-300 mb-3" />
                            <p className="text-sm font-bold text-slate-600">No nodes configured</p>
                            <p className="text-[11px] text-slate-400 font-medium mt-1">Add nodes to make your template interactive</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {form.buttons.map((btn, index) => (
                                <div key={index} className="group relative bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 transition-all hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/5">
                                    <button
                                        type="button"
                                        onClick={() => removeButton(index)}
                                        className="absolute -top-3 -right-3 w-8 h-8 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 rounded-full flex items-center justify-center shadow-sm transition-all z-10"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-hover:text-violet-500">Node Label</label>
                                            <input
                                                className="w-full h-11 px-4 bg-slate-50/50 border border-slate-200/60 rounded-xl text-slate-900 text-sm font-bold focus:border-violet-500 outline-none transition-all"
                                                placeholder="e.g. Access Portal"
                                                value={btn.label}
                                                onChange={(e) => {
                                                    const copy = [...form.buttons];
                                                    copy[index].label = e.target.value;
                                                    setForm({ ...form, buttons: copy });
                                                }}
                                            />
                                        </div>

                                        <div className="space-y-2.5 relative group/dd">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-hover/dd:text-violet-500">Logic Function</label>
                                            <CustomDropdown
                                                value={btn.actionType}
                                                onChange={(value) => {
                                                    const copy = [...form.buttons];
                                                    copy[index].actionType = value;
                                                    setForm({ ...form, buttons: copy });
                                                }}
                                                options={[
                                                    { value: "reply", label: "Quick Reply" }
                                                ]}
                                                placeholder="Select function"
                                                className="h-11 rounded-xl bg-slate-50/50 border-slate-200/60 shadow-sm hover:bg-white focus:bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* SUBMIT BUTTON */}
                <div className="mt-8 pt-8 border-t border-slate-100 flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting || isUploading}
                        className="group relative flex items-center justify-center gap-3 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden w-full sm:w-auto min-w-[200px]"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="uppercase tracking-widest text-[11px]">Syncing...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="uppercase tracking-widest text-[11px]">Deploy Module</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}
