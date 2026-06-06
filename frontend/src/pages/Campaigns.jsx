import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/useAuth";
import CustomSelect from "../components/UI/CustomSelect";
import CampaignForm from "../components/CampaignForm";

import CampaignList from "../components/CampaignList";
import CampaignPreview from "../components/CampaignPreview";
import nicePrompt from "../components/UI/NicePrompt";
import { Search, Plus, Zap, Play, Clock, CheckCircle, Lock, X } from 'lucide-react';

export default function Campaigns() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [campaigns, setCampaigns] = useState([]);

  const [editing, setEditing] = useState(null);
  const isEditingLoaded = useRef(false);


  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaNumbers, setWabaNumbers] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  // 🔥 Filter campaigns based on search, status, and date
  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = !search ||
      campaign.name?.toLowerCase().includes(search.toLowerCase()) ||
      campaign.templateName?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;

    const matchesDate = !dateFilter || (
      campaign.createdAt && new Date(campaign.createdAt).toISOString().split('T')[0] === dateFilter
    );

    return matchesSearch && matchesStatus && matchesDate;
  });

  const isLimitReached = user?.role !== 'superadmin' &&
    user?.limits?.campaigns?.used >= user?.limits?.campaigns?.limit;


  // 🔥 THIS CONTROLS VIEW
  const [showForm, setShowForm] = useState(false);

  // 🔥 Preview state
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewVariables, setPreviewVariables] = useState([]);
  const [previewHeaderOverride, setPreviewHeaderOverride] = useState(null);

  const loadCampaigns = useCallback(async () => {
    try {
      const timestamp = Date.now();
      const res = await api.get(`/campaigns?t=${timestamp}`);
      setCampaigns(res.data.campaigns || []);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    }
  }, []);

  // ✅ Reusable Edit Handler (extracted from CampaignList onEdit)
  const handleEdit = useCallback((c) => {
    if (!c) return;

    const normalizedCampaign = {
      ...c,
      recipientSource: c.recipientSource || "group",
      groupIds: Array.isArray(c.groupIds) ? c.groupIds.map(String) : [],
      template: c.template ? {
        ...c.template,
        metaTemplateName: c.template.metaTemplateName || c.template.name,
        language: c.template.language || "en_US",
        variables: c.template.variables || [],
        variableTypes: c.template.variableTypes || [],
      } : null,
    };

    setPhoneNumberId(c.phoneNumberId || "");
    setEditing(normalizedCampaign);

    // ✅ Convert campaign template to Meta format for preview
    if (normalizedCampaign.template) {
      const campaignTemplate = normalizedCampaign.template;
      if (campaignTemplate.components) {
        setPreviewTemplate(campaignTemplate);
      } else {
        const metaTemplate = {
          name: campaignTemplate.metaTemplateName || campaignTemplate.name,
          components: []
        };
        if (campaignTemplate.header) {
          metaTemplate.components.push({
            type: "HEADER",
            format: campaignTemplate.header.type?.toUpperCase() || "TEXT",
            text: campaignTemplate.header.text || "",
            example: campaignTemplate.header.example || {}
          });
        }
        if (campaignTemplate.body) {
          metaTemplate.components.push({ type: "BODY", text: campaignTemplate.body });
        }
        if (campaignTemplate.buttons && campaignTemplate.buttons.length > 0) {
          metaTemplate.components.push({ type: "BUTTONS", buttons: campaignTemplate.buttons });
        }
        setPreviewTemplate(metaTemplate);
      }
      const vars = campaignTemplate.variableTypes || campaignTemplate.variables || [];
      setPreviewVariables(vars);
      setPreviewHeaderOverride(normalizedCampaign.headerOverrideUrl || normalizedCampaign.headerOverrideHandle || null);
    } else {
      setPreviewTemplate(null);
      setPreviewVariables([]);
      setPreviewHeaderOverride(null);
    }
    setShowForm(true);
  }, []);

  // Load campaigns on mount
  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Handle direct edit from URL / ID param
  useEffect(() => {
    if (id && campaigns.length > 0 && !isEditingLoaded.current) {
      const campToEdit = campaigns.find(c => c._id === id);
      if (campToEdit) {
        console.log("🛠️ Detected campaign ID from URL - loading editor for:", campToEdit.name);
        handleEdit(campToEdit);
        isEditingLoaded.current = true;
      }
    }
  }, [id, campaigns, handleEdit]);

  // 🔥 Reset form if navigating back to base campaigns list from sidebar
  useEffect(() => {
    if (location.pathname === '/campaigns/whatsapp' || location.pathname === '/campaigns') {
      if (!id) {
        setShowForm(false);
        setEditing(null);
        isEditingLoaded.current = false;
      }
    }
  }, [location.pathname, location.key, id]);

  // ✅ Auto-refresh when campaigns are running
  useEffect(() => {
    const hasActiveCampaigns = campaigns.some(c => c.status === "running" || c.status === "scheduled");

    if (hasActiveCampaigns && !showForm) {
      const interval = setInterval(() => {
        loadCampaigns();
      }, 2000); // Fast poll every 2 seconds for real-time feel
      return () => clearInterval(interval);
    }
  }, [campaigns, showForm, loadCampaigns]);

  useEffect(() => {
    const loadWabaNumbers = async () => {
      try {
        const res = await api.get("/waba/numbers");
        setWabaNumbers(res.data || []);
      } catch (err) {
        console.error("Failed to load WABA numbers", err);
      }
    };

    loadWabaNumbers();
  }, []);


  // Handle template selection and variable updates
  const handleTemplateSelect = (template) => {
    console.log("🔥 TEMPLATE SELECTED:", template);

    // 🔥 CRITICAL: Ensure full template object with components
    if (template && template.components) {
      // Full Meta template object - use as-is
      setPreviewTemplate(template);
    } else if (template && (template.header || template.body || template.buttons)) {
      // Local template format - convert to Meta format
      const metaTemplate = {
        name: template.name,
        components: []
      };

      // Add header component if exists
      if (template.header) {
        const headerComponent = {
          type: "HEADER",
          format: template.header.type?.toUpperCase() || "TEXT",
          text: template.header.text || ""
        };

        // Add example data for image headers
        if (template.header.type === "image" && template.header.example) {
          headerComponent.example = {
            image_url: template.header.example.image_url || template.header.example
          };
        }

        metaTemplate.components.push(headerComponent);
      }

      // Add body component if exists
      if (template.body) {
        metaTemplate.components.push({
          type: "BODY",
          text: template.body
        });
      }

      // Add footer component if exists
      if (template.footer) {
        metaTemplate.components.push({
          type: "FOOTER",
          text: template.footer
        });
      }

      // Add buttons component if exists
      if (template.buttons && template.buttons.length > 0) {
        metaTemplate.components.push({
          type: "BUTTONS",
          buttons: template.buttons
        });
      }

      console.log("🔥 CONVERTED TO META FORMAT:", metaTemplate);
      setPreviewTemplate(metaTemplate);
    } else {
      console.log("🔥 NO VALID TEMPLATE DATA");
      setPreviewTemplate(null);
      setPreviewHeaderOverride(null);
    }
  };

  // Initialize variables if template has them
  const handleVariableChange = (variables) => {
    setPreviewVariables(variables);
  };

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden font-poppins">

      {/* ✅ PAGE HEADER & TOOLBAR */}
      <div className="flex-shrink-0 px-5 pt-4 pb-0">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 w-full xl:w-auto">
            {!showForm && (
              <div className="flex flex-1 items-center gap-3 w-full xl:w-auto">
                <div className="relative flex-1 max-w-md group">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search campaigns..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-9 pl-10 pr-4 bg-white border border-slate-200/60 rounded-lg text-xs font-medium text-slate-600 focus:border-blue-500 transition-all outline-none shadow-sm shadow-slate-200/10"
                  />
                </div>

                <div className="relative group min-w-[150px]">
                  <CustomSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { label: "All Status", value: "all" },
                      { label: "Scheduled", value: "scheduled" },
                      { label: "Completed", value: "completed" },
                    ]}
                  />
                </div>

              </div>
            )}
          </div>

          <div className="flex items-center gap-4 ml-auto">
            {!showForm && (
              <button
                onClick={() => {
                  if (isLimitReached) return;
                  setEditing(null);
                  setPreviewTemplate(null);
                  setPreviewVariables([]);
                  setShowForm(true);
                }}
                disabled={isLimitReached}
                className={`h-9 px-4 rounded-lg font-bold text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 group shadow-sm ${isLimitReached
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                  : 'bg-blue-600 text-white hover:bg-black'
                  }`}
                title={isLimitReached ? "Campaign limit reached. Upgrade your plan." : ""}
              >
                {isLimitReached ? <Lock size={14} /> : <Plus size={14} strokeWidth={3} />}
                <span>{isLimitReached ? "Limit Reached" : "Create Campaign"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ✅ MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden px-5 pb-5 pt-3">
        {!showForm ? (
          <div className="flex-1 flex flex-col w-full mx-auto gap-4 overflow-hidden">
            {/* Stats Grid */}
            <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Campaigns", value: campaigns.length, icon: Zap, color: "blue" },
                { label: "Running Now", value: campaigns.filter(c => c.status === "running").length, icon: Play, color: "emerald" },
                { label: "Scheduled", value: campaigns.filter(c => c.status === "scheduled").length, icon: Clock, color: "amber" },
                { label: "Completed", value: campaigns.filter(c => c.status === "completed").length, icon: CheckCircle, color: "purple" }
              ].map((stat, i) => (
                <div key={i} className="bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-xl p-4 transition-all hover:-translate-y-1 flex flex-col justify-between group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-poppins leading-tight">{stat.label}</span>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110
                      ${stat.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                        stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                          stat.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                            'bg-purple-50 text-purple-600'}`}
                    >
                      <stat.icon className="w-4 h-4" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="text-xl text-slate-800 font-poppins font-bold tracking-tight">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Campaigns Table Container */}
            <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
              <CampaignList
                campaigns={filteredCampaigns}
                refresh={loadCampaigns}
                onEdit={(c) => handleEdit(c)} />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto w-full mx-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col xl:flex-row items-start gap-8">
              {/* Left Side: Main Form Area */}
              <div className="flex-1 min-w-0 w-full xl:w-auto">
                <CampaignForm
                  editing={editing}
                  phoneNumberId={phoneNumberId}
                  setPhoneNumberId={setPhoneNumberId}
                  wabaNumbers={wabaNumbers}
                  onSaved={() => {
                    loadCampaigns();
                    setEditing(null);
                    setShowForm(false);
                    isEditingLoaded.current = false;
                    if (id) navigate('/campaigns');
                  }}
                  onTemplateSelect={handleTemplateSelect}
                  onVariableChange={handleVariableChange}
                  onHeaderOverrideChange={setPreviewHeaderOverride}
                  onBack={() => {
                    setEditing(null);
                    setPreviewTemplate(null);
                    setPreviewVariables([]);
                    setPreviewHeaderOverride(null);
                    setShowForm(false);
                    isEditingLoaded.current = false;
                    if (id) navigate('/campaigns');
                  }}
                />
              </div>

              {/* Right Side: Sticky Preview Area */}
              <div className="w-full xl:w-[420px] xl:sticky xl:top-0 space-y-8">
                <CampaignPreview
                  template={previewTemplate}
                  variables={previewVariables}
                  headerOverride={previewHeaderOverride}
                />

                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group border border-white/5">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-500/20 transition-all duration-700"></div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center text-xl shadow-inner border border-white/10 group-hover:scale-110 transition-transform">
                        💡
                      </div>
                      <h3 className="text-lg font-bold text-white tracking-tight">Success Tips</h3>
                    </div>
                    <ul className="space-y-4">
                      {[
                        { icon: "📝", text: "Personalize with dynamic variables to increase engagement" },
                        { icon: "🎯", text: "Segment your audience into targeted contact groups" },
                        { icon: "⏰", text: "Schedule for peak activity hours in your region" },
                        { icon: "🛑", text: "Always provide an easy way for users to opt-out" }
                      ].map((tip, i) => (
                        <li key={i} className="flex gap-3 text-[12px] text-slate-400 leading-relaxed font-bold group/tip">
                          <span className="shrink-0 w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center text-[12px] group-hover/tip:bg-blue-500/20 group-hover/tip:text-white transition-all">{tip.icon}</span>
                          <span className="group-hover/tip:text-slate-100 transition-colors pt-0.5">{tip.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
