import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";
import {
  Bot, 
  Plus, 
  Search, 
  Eye, 
  Trash2, 
  Activity,
  Layers,
  X,
  Share2, Lock, CheckCircle2, Menu, Copy, List, ChevronDown, Settings, RefreshCw, UploadCloud, Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import WhatsAppFlowPreview from "./WhatsAppFlowPreview";
import DensitySelector from "../../components/UI/DensitySelector";

export default function WhatsAppFlowsList() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowCategory, setNewFlowCategory] = useState("");
  const [newFlowChannel, setNewFlowChannel] = useState("");
  const [channels, setChannels] = useState([]);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [previewFlowId, setPreviewFlowId] = useState(null);
  
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    return Number(localStorage.getItem("whatsapp_flows_density")) || 10;
  });

  const handleDensityChange = (value) => {
    setItemsPerPage(value);
    localStorage.setItem("whatsapp_flows_density", value);
  };
  
  const navigate = useNavigate();

  const loadFlows = async () => {
    try {
      setLoading(true);
      const res = await api.get("/whatsapp-flows");
      setFlows(res.data.data || []);
      
      try {
        const chanRes = await api.get("/whatsapp-flows/integrations");
        setChannels(chanRes.data.data || []);
      } catch (err) {
        console.error("Failed to load integrations:", err);
      }
    } catch (err) {
      console.error("Failed to load WhatsApp flows:", err);
      // Fallback for UI if API is not fully hooked up
      setFlows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlows();
  }, []);

  const deleteFlow = async (id) => {
    if (!window.confirm("Delete this WhatsApp flow? This cannot be undone.")) return;
    try {
      await api.delete(`/whatsapp-flows/${id}`);
      toast.success("Flow deleted successfully");
      loadFlows();
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete flow");
    }
  };

  const syncFlow = async (id) => {
    const toastId = toast.loading("Syncing with Meta...");
    try {
      await api.post(`/whatsapp-flows/${id}/sync`);
      toast.success("Flow JSON uploaded to Meta successfully!", { id: toastId });
      loadFlows();
    } catch (err) {
      console.error("Sync failed:", err);
      toast.error(err.response?.data?.message || "Failed to sync flow with Meta", { id: toastId });
    }
  };

  const publishFlow = async (id) => {
    if (!window.confirm("Are you sure you want to Publish this flow? Once published, it cannot be easily edited.")) return;
    const toastId = toast.loading("Publishing Flow...");
    try {
      await api.post(`/whatsapp-flows/${id}/publish`);
      toast.success("Flow published successfully!", { id: toastId });
      loadFlows();
    } catch (err) {
      console.error("Publish failed:", err);
      toast.error(err.response?.data?.message || "Failed to publish flow to Meta", { id: toastId });
    }
  };

  const handleCreateFlow = async (e) => {
    e.preventDefault();
    if (creating) return;
    if (!newFlowName.trim()) return;
    
    // Generate default layout based on category
    let defaultComponents = [];
    if (newFlowCategory === 'Sign in') {
      defaultComponents = [
        { id: `comp_${Date.now()}_1`, type: 'Email', label: 'Email', required: true, placeholder: 'Enter your email' },
        { id: `comp_${Date.now()}_2`, type: 'Password', label: 'Password', required: true, placeholder: 'Enter your password' }
      ];
    } else if (newFlowCategory === 'Sign up') {
      defaultComponents = [
        { id: `comp_${Date.now()}_1`, type: 'Input', label: 'Full Name', required: true, placeholder: 'Enter full name' },
        { id: `comp_${Date.now()}_2`, type: 'Email', label: 'Email', required: true, placeholder: 'Enter email address' },
        { id: `comp_${Date.now()}_3`, type: 'Phone', label: 'Phone Number', required: true, placeholder: 'Enter phone number' }
      ];
    } else if (newFlowCategory === 'Appointment Booking') {
      defaultComponents = [
        { id: `comp_${Date.now()}_1`, type: 'Input', label: 'Full Name', required: true, placeholder: 'Enter your name' },
        { id: `comp_${Date.now()}_2`, type: 'Phone', label: 'Phone Number', required: true, placeholder: 'Enter phone number' },
        { id: `comp_${Date.now()}_3`, type: 'Date', label: 'Preferred Date', required: true, placeholder: 'Select date' },
        { id: `comp_${Date.now()}_4`, type: 'Dropdown', label: 'Select Service', required: true, options: ['Consultation', 'Follow-up', 'General Inquiry'] }
      ];
    } else if (newFlowCategory === 'Lead Generation') {
      defaultComponents = [
        { id: `comp_${Date.now()}_1`, type: 'Input', label: 'Full Name', required: true, placeholder: 'Enter full name' },
        { id: `comp_${Date.now()}_2`, type: 'Email', label: 'Email', required: true, placeholder: 'Enter email address' },
        { id: `comp_${Date.now()}_3`, type: 'Input', label: 'Company Name', required: false, placeholder: 'Enter company name' },
        { id: `comp_${Date.now()}_4`, type: 'Dropdown', label: 'Industry', required: false, options: ['Technology', 'Healthcare', 'Finance', 'Retail', 'Other'] }
      ];
    } else if (newFlowCategory === 'Contact Us') {
      defaultComponents = [
        { id: `comp_${Date.now()}_1`, type: 'Input', label: 'Name', required: true, placeholder: 'Enter your name' },
        { id: `comp_${Date.now()}_2`, type: 'Email', label: 'Email Address', required: true, placeholder: 'Enter your email' },
        { id: `comp_${Date.now()}_3`, type: 'Textarea', label: 'Message', required: true, placeholder: 'How can we help you?' }
      ];
    } else if (newFlowCategory === 'Customer Support') {
      defaultComponents = [
        { id: `comp_${Date.now()}_1`, type: 'Input', label: 'Name', required: true, placeholder: 'Enter your name' },
        { id: `comp_${Date.now()}_2`, type: 'Input', label: 'Order ID', required: false, placeholder: 'E.g. #12345' },
        { id: `comp_${Date.now()}_3`, type: 'Dropdown', label: 'Issue Type', required: true, options: ['Payment Issue', 'Delivery Tracking', 'Product Defect', 'Other'] },
        { id: `comp_${Date.now()}_4`, type: 'Textarea', label: 'Describe Issue', required: true, placeholder: 'Please describe the issue in detail' }
      ];
    } else if (newFlowCategory === 'Survey') {
      defaultComponents = [
        { id: `comp_${Date.now()}_1`, type: 'Radio', label: 'Overall Satisfaction', required: true, options: ['Excellent', 'Good', 'Average', 'Poor'] },
        { id: `comp_${Date.now()}_2`, type: 'Dropdown', label: 'How did you hear about us?', required: true, options: ['Social Media', 'Search Engine', 'Friend/Family', 'Other'] },
        { id: `comp_${Date.now()}_3`, type: 'Textarea', label: 'Additional Feedback', required: false, placeholder: 'Any thoughts to share?' }
      ];
    } else {
      defaultComponents = [
        { id: `comp_${Date.now()}_1`, type: 'Input', label: 'Name', required: false, placeholder: 'Kindly Enter name' },
        { id: `comp_${Date.now()}_2`, type: 'Phone', label: 'Phone Number', required: false, placeholder: 'Enter Phone Number' },
        { id: `comp_${Date.now()}_3`, type: 'Email', label: 'Email', required: false, placeholder: 'Enter Email' }
      ];
    }

    const defaultLayout = {
      screens: [
        { id: 'screen_1', name: 'Welcome Screen', components: defaultComponents }
      ]
    };

    try {
      setCreating(true);
      const res = await api.post("/whatsapp-flows", {
        name: newFlowName,
        categories: newFlowCategory ? [newFlowCategory] : [],
        whatsappChannel: newFlowChannel,
        layout: defaultLayout
      });
      toast.success("Flow Created!");
      setShowCreateModal(false);
      setNewFlowName("");
      setNewFlowCategory("");
      setNewFlowChannel("");
      // Navigate to the builder for the new flow
      if (res.data && res.data.data && res.data.data._id) {
        navigate(`/automation/whatsapp-flows/${res.data.data._id}`);
      } else {
        loadFlows();
      }
    } catch (err) {
      console.error("Failed to create flow:", err);
      toast.error(err.response?.data?.message || "Failed to create flow");
    } finally {
      setCreating(false);
    }
  };

  const filteredFlows = flows.filter(f => 
    f.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const paginatedFlows = filteredFlows.slice(0, itemsPerPage);

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden font-poppins selection:bg-blue-100">
      {/* Header Section */}
      <div className="px-6 py-6 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Search WhatsApp flows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-blue-500/50 transition-all outline-none placeholder:text-slate-300"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black tracking-widest border border-blue-100/50 shadow-sm uppercase">
              <Activity size={12} className="animate-pulse" /> {flows.length} Total Flows
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DensitySelector value={itemsPerPage} onChange={handleDensityChange} />
            <div className="w-px h-8 bg-slate-200 mx-1"></div>
            <button
              onClick={() => {
                toast.success("Refreshing flows...");
                loadFlows();
              }}
              disabled={loading}
              className="h-11 px-5 flex items-center gap-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-[12px] font-semibold tracking-wide hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 shadow-sm disabled:opacity-70 disabled:cursor-wait"
            >
              <RefreshCw size={16} className={`text-blue-500 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="h-11 px-6 flex items-center gap-2 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <Plus size={16} strokeWidth={3} />
              Create New Flow
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="h-full bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-[13px] text-slate-600">
              <thead className="bg-slate-100/50 text-slate-800 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 w-36">META STATUS</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Channel</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-center w-64">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flows.length === 0 && !loading && (
                  <tr>
                    <td colSpan="5" className="px-6 py-16 text-center text-slate-500">
                      No flows found. Click "Create New Flow" to get started.
                    </td>
                  </tr>
                )}
                {paginatedFlows.map((flow) => {
                  const status = flow.status || 'DRAFT';
                  let statusColors = 'border-slate-200 text-slate-500 bg-slate-50';
                  let dotColor = 'bg-slate-400';
                  
                  if (status === 'PUBLISHED' || status === 'APPROVED') {
                    statusColors = 'border-green-200 text-green-600 bg-green-50/50';
                    dotColor = 'bg-green-500';
                  } else if (status === 'PENDING') {
                    statusColors = 'border-orange-200 text-orange-600 bg-orange-50/50';
                    dotColor = 'bg-orange-500';
                  } else if (status === 'REJECTED') {
                    statusColors = 'border-red-200 text-red-600 bg-red-50/50';
                    dotColor = 'bg-red-500';
                  }

                  return (
                    <tr key={flow._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`flex items-center gap-1.5 w-max px-2.5 py-1 text-[11px] font-bold rounded-full border ${statusColors} uppercase tracking-wider`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 text-[14px]">{flow.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-400">{flow._id || flow.flowId}</span>
                          <Copy size={12} className="text-slate-400 hover:text-[#00a884] cursor-pointer" />
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">
                        {flow.whatsappChannel || '01 Automations'}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">
                        {flow.categories?.[0] || 'Lead Generation'}
                      </td>
                      <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => navigate(`/automation/whatsapp-flows/${flow._id}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-md text-[12px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <Layers size={14} /> Edit
                        </button>

                        <button 
                          onClick={() => setPreviewFlowId(flow._id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-md text-[12px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <Eye size={14} /> Preview
                        </button>

                        <button 
                          onClick={() => syncFlow(flow._id)}
                          disabled={status === 'PUBLISHED'}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 bg-blue-50/50 rounded-md text-[12px] font-semibold text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          <UploadCloud size={14} /> Sync
                        </button>

                        <button 
                          onClick={() => publishFlow(flow._id)}
                          disabled={status === 'PUBLISHED'}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#00a884]/30 bg-[#00a884]/5 rounded-md text-[12px] font-semibold text-[#00a884] hover:bg-[#00a884]/10 transition-colors disabled:opacity-50"
                        >
                          <Send size={14} /> Publish
                        </button>

                        <button 
                          onClick={() => deleteFlow(flow._id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-md text-[12px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer - Consistency */}
          <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              WhatsApp Flows Registry • Page <span className="text-blue-600">01</span>
            </div>
            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
              Showing {paginatedFlows.length} of {filteredFlows.length} Flows Found
            </div>
          </div>
        </div>
      </div>

      {/* Create Flow Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-[101] overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Create WhatsApp Flow</h3>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Initialize new Meta Flow</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateFlow} className="p-5 bg-white">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={newFlowName}
                      onChange={(e) => setNewFlowName(e.target.value)}
                      placeholder="Enter Flow Name"
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-md text-sm text-slate-800 focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Categories
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenDropdownId(openDropdownId === 'category' ? null : 'category')}
                        className={`w-full h-10 px-3 flex items-center justify-between bg-white border rounded-md text-sm transition-all outline-none ${
                          openDropdownId === 'category' ? 'border-[#00a884] ring-1 ring-[#00a884] text-slate-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className={newFlowCategory ? "text-slate-800" : "text-slate-400"}>
                          {newFlowCategory || "Select Flow Category"}
                        </span>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${openDropdownId === 'category' ? 'rotate-180' : ''}`} />
                      </button>
                      
                      <AnimatePresence>
                        {openDropdownId === 'category' && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto custom-scrollbar"
                          >
                            {['Sign up', 'Sign in', 'Appointment Booking', 'Lead Generation', 'Contact Us', 'Customer Support', 'Survey', 'Other'].map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => {
                                  setNewFlowCategory(cat);
                                  setOpenDropdownId(null);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-[#00a884]/10 hover:text-[#00a884] transition-colors ${
                                  newFlowCategory === cat ? 'bg-[#00a884]/5 text-[#00a884] font-semibold' : 'text-slate-700'
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      WhatsApp Channel
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenDropdownId(openDropdownId === 'channel' ? null : 'channel')}
                        className={`w-full h-10 px-3 flex items-center justify-between bg-white border rounded-md text-sm transition-all outline-none ${
                          openDropdownId === 'channel' ? 'border-[#00a884] ring-1 ring-[#00a884] text-slate-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className={newFlowChannel ? "text-slate-800" : "text-slate-400"}>
                          {newFlowChannel || "Select WhatsApp Channel"}
                        </span>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${openDropdownId === 'channel' ? 'rotate-180' : ''}`} />
                      </button>
                      
                      <AnimatePresence>
                        {openDropdownId === 'channel' && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto custom-scrollbar"
                          >
                            {channels.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-slate-400">No integrated channels found</div>
                            ) : (
                              channels.map(chan => (
                                <button
                                  key={chan}
                                  type="button"
                                  onClick={() => {
                                    setNewFlowChannel(chan);
                                    setOpenDropdownId(null);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[#00a884]/10 hover:text-[#00a884] transition-colors ${
                                    newFlowChannel === chan ? 'bg-[#00a884]/5 text-[#00a884] font-semibold' : 'text-slate-700'
                                  }`}
                                >
                                  {chan}
                                </button>
                              ))
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={creating || !newFlowName.trim()}
                    className="h-9 px-5 bg-[#00a884] text-white rounded-md text-sm font-semibold hover:bg-[#008f6f] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {creating ? 'Creating...' : 'Create Flow'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Preview Modal */}
      {previewFlowId && (
        <WhatsAppFlowPreview flowId={previewFlowId} onClose={() => setPreviewFlowId(null)} />
      )}
    </div>
  );
}
