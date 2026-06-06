import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, Zap, Clock, Users, Link, Upload, Trash2, Image as ImageIcon, Calendar, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import CustomDatePicker from "./UI/CustomDatePicker";
import CustomTimePicker from "./UI/CustomTimePicker";
import CustomSelect from "./UI/CustomSelect";

/* ---------------- DEFAULT STATE ---------------- */
const emptyForm = {
  name: "",
  template: null,
  recipientSource: "group", // group | addNumber | importCsv
  scheduledAt: "",
  templateVariables: [], // Array of variable values
  variableTypes: [], // Array of {index, type, value}
  headerOverrideUrl: "",
  headerOverrideHandle: "",
  catalogThumbnailSku: "", // Selected product SKU for catalog templates
};

const emptyManualRecipient = {
  name: "",
  mobile: "",
  countryCode: "91"
};

const emptyCsvState = {
  file: null,
  isUploading: false,
  importResult: null,
};

export default function CampaignForm({
  editing,
  phoneNumberId,
  setPhoneNumberId,
  wabaNumbers,
  onSaved,
  onTemplateSelect,
  onVariableChange,
  onHeaderOverrideChange,
  onBack,
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("group");

  const [templates, setTemplates] = useState([]);
  const [wabas, setWabas] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inventoryProducts, setInventoryProducts] = useState([]); // For Catalog thumbnails

  // Tab states
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [manualRecipients, setManualRecipients] = useState([]);
  const [csvState, setCsvState] = useState(emptyCsvState);
  const [manualRecipientForm, setManualRecipientForm] = useState(emptyManualRecipient);
  const [defaultCountry, setDefaultCountry] = useState("in"); // for CSV and manual
  const [selectedCountryCode, setSelectedCountryCode] = useState("91"); // numeric code
  const [selectedContacts, setSelectedContacts] = useState([]); // 🔥 Added for individual contacts
  const [allContacts, setAllContacts] = useState([]); // 🔥 Added to show contacts list
  const [contactSearch, setContactSearch] = useState(""); // 🔥 Added for contact search
  const [contactsLoading, setContactsLoading] = useState(false);
  const [showContactsInGroups, setShowContactsInGroups] = useState(false); // 🔥 Added for unified tab

  // Template variables
  const [parsedVariables, setParsedVariables] = useState([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [phoneSelectOpen, setPhoneSelectOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState("All Categories");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  
  // Bulk Paste States
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [skipExtraLines, setSkipExtraLines] = useState(false);
  const [mergeRemaining, setMergeRemaining] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (templateDropdownOpen && !event.target.closest('.template-dropdown')) {
        setTemplateDropdownOpen(false);
      }
      if (phoneSelectOpen && !event.target.closest('.phone-dropdown')) {
        setPhoneSelectOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [templateDropdownOpen, phoneSelectOpen]);

  /* ---------------- LOADERS ---------------- */
  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get("/templates");
      setTemplates(res.data.templates || []);
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }, []);

  const loadWabas = useCallback(async () => {
    try {
      const res = await api.get("/waba/phone-numbers");
      setWabas(res.data.phoneNumbers || []);
    } catch (err) {
      console.error("Failed to load WABAs:", err);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      setContactsLoading(true);
      const res = await api.get("/contacts?limit=1000");
      setAllContacts(res.data.contacts || []);
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await api.get("/contact-groups");
      setGroups(res.data.groups || []);
    } catch (err) {
      console.error("Failed to load groups:", err);
    }
  }, []);

  const loadInventory = useCallback(async () => {
    try {
      const res = await api.get("/commerce/products/skus");
      if (res.data.success) {
        setInventoryProducts(res.data.products || []);
      }
    } catch (err) {
      console.error("Failed to fetch inventory for campaigns:", err);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadWabas();
    loadGroups();
    loadContacts(); // 🔥 Load contacts for the unified tab
    loadInventory();
  }, [loadTemplates, loadWabas, loadGroups, loadContacts, loadInventory]);

  /* ---------------- EDIT MODE (FIXED) ---------------- */
  useEffect(() => {
    if (!editing) return;

    // 1️⃣ Reset all recipient-related state FIRST
    setSelectedGroups((editing.groupIds || []).map(g => (g._id || g).toString()));
    setSelectedContacts((editing.contactIds || []).map(c => (c._id || c).toString()));
    setManualRecipients([]);
    setCsvState(emptyCsvState);

    // 2️⃣ Restore basic form data
    setForm({
      name: editing.name || "",
      template: editing.template
        ? {
          ...editing.template,
          metaTemplateName:
            editing.template.metaTemplateName || editing.template.name,
        }
        : null,
      recipientSource: editing.recipientSource || "group",
      scheduledAt: editing.scheduledAt
        ? new Date(editing.scheduledAt).toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16)
        : "",
      templateVariables: editing.template?.variables || [],
      variableTypes: editing.template?.variableTypes || [],
      headerOverrideUrl: editing.headerOverrideUrl || "",
      headerOverrideHandle: editing.headerOverrideHandle || "",
      catalogThumbnailSku: editing.template?.catalogThumbnailSku || "",
    });

    // 3️⃣ Restore active tab and selected groups
    const source = editing.recipientSource || "group";
    setActiveTab(source === "contacts" ? "group" : source);
    setShowContactsInGroups(source === "contacts");
    // Already set above in reset step but ensuring consistency
    setSelectedGroups((editing.groupIds || []).map(id => id.toString()));

    // 4️⃣ Load recipients ONLY when needed
    if (editing.recipientSource !== "group") {
      loadCampaignNumbers(editing._id);
    }

    // 5️⃣ Restore template preview
    if (editing.template) {
      const normalizedTemplate = {
        ...editing.template,
        metaTemplateName:
          editing.template.metaTemplateName || editing.template.name,
      };

      const initialVariables = parseTemplateVariables(normalizedTemplate, {
        variableTypes: editing.template?.variableTypes || [],
        templateVariables: editing.template?.variables || []
      });
      onVariableChange?.(initialVariables);
      onTemplateSelect?.(normalizedTemplate);

      // Update override in parent/preview if exists
      if (editing.headerOverrideUrl || editing.headerOverrideHandle) {
        onHeaderOverrideChange?.(editing.headerOverrideUrl || editing.headerOverrideHandle);
      }
    }

  }, [editing]);


  const loadCampaignNumbers = async (campaignId) => {
    try {
      const res = await api.get(`/campaign-numbers/${campaignId}/numbers`);
      setManualRecipients(res.data.numbers || []);
    } catch (err) {
      console.error("Failed to load campaign numbers:", err);
    }
  };

  /* ---------------- TEMPLATE VARIABLE HANDLING ---------------- */
  const parseTemplateVariables = (template, initialData = null) => {
    if (!template) {
      setParsedVariables([]);
      return;
    }

    const bodyText = template.components?.find(c => c.type === "BODY")?.text ||
      template.body || "";

    const variableRegex = /\{\{(\d+)\}\}/g;
    const variables = [];
    let match;

    while ((match = variableRegex.exec(bodyText)) !== null) {
      const index = parseInt(match[1]);
      variables.push({
        index,
        placeholder: match[0],
        type: initialData?.variableTypes?.[index - 1]?.type || form.variableTypes[index - 1]?.type || "static",
        value: initialData?.variableTypes?.[index - 1]?.value || initialData?.templateVariables?.[index - 1] || form.variableTypes[index - 1]?.value || form.templateVariables[index - 1] || "",
      });
    }

    setParsedVariables(variables);
    return variables;
  };

  const updateVariable = (varIndex, field, value) => {
    const updatedVariables = parsedVariables.map(v =>
      v.index === varIndex ? { ...v, [field]: value } : v
    );
    setParsedVariables(updatedVariables);

    // Update form state
    const updatedTypes = [...form.variableTypes];
    updatedTypes[varIndex - 1] = {
      index: varIndex,
      type: updatedVariables.find(v => v.index === varIndex).type,
      value: updatedVariables.find(v => v.index === varIndex).value,
    };
    setForm(prev => ({ ...prev, variableTypes: updatedTypes }));

    // Notify parent of variable changes for live preview
    onVariableChange?.(updatedVariables);
  };

  /* ---------------- BULK PASTE LOGIC ---------------- */
  const applyBulkPaste = () => {
    if (!parsedVariables.length || !pasteValue) return;

    const lines = pasteValue.split("\n").map(l => l.trim()).filter(l => l !== "");
    const updatedVariables = [...parsedVariables];

    // Create copies of form arrays to update in a single state call
    const newVariableTypes = [...form.variableTypes];
    const newTemplateVariables = [...form.templateVariables];

    updatedVariables.forEach((v, index) => {
      if (index < lines.length) {
        let value = lines[index];
        if (index === updatedVariables.length - 1 && mergeRemaining && lines.length > updatedVariables.length) {
          // Merge remaining lines into last variable
          value = lines.slice(index).join(" ");
        }

        // Update local array for parsedVariables state
        updatedVariables[index] = { ...v, value };

        // Update form state arrays
        newVariableTypes[v.index - 1] = {
          index: v.index,
          type: v.type,
          value: value,
        };
        newTemplateVariables[v.index - 1] = value;
      }
    });

    setParsedVariables(updatedVariables);
    setForm(prev => ({
      ...prev,
      variableTypes: newVariableTypes,
      templateVariables: newTemplateVariables
    }));

    onVariableChange?.(updatedVariables);
    setShowPasteModal(false);
    setPasteValue("");
  };

  /* ---------------- TAB HANDLERS ---------------- */
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const actualSource = (tab === 'group' && showContactsInGroups) ? 'contacts' : tab;
    setForm(prev => ({ ...prev, recipientSource: actualSource }));
    // 💡 Persistent State: We no longer reset manualRecipients or selectedGroups here.
    // This allows users to combine sources (e.g., Target a Group + Add a few extra numbers).
  };

  /* ---------------- GROUP TAB HANDLERS ---------------- */
  const toggleGroup = (groupId) => {
    const id = groupId.toString();
    setSelectedGroups(prev =>
      prev.includes(id)
        ? prev.filter(g => g !== id)
        : [...prev, id]
    );
  };

  /* ---------------- MANUAL RECIPIENT HANDLERS ---------------- */
  const addManualRecipient = async () => {
    if (!manualRecipientForm.mobile.trim()) {
      alert("Phone number is required");
      return;
    }

    // 🔥 Duplicate Check
    const cleanPhone = manualRecipientForm.mobile.replace(/\D/g, "");
    const isDuplicate = manualRecipients.some(r => r.phone === cleanPhone);
    if (isDuplicate) {
      nicePrompt.error("Duplicate Number", "This phone number is already added to the recipient list.");
      return;
    }

    try {
      setLoading(true);

      // 🔥 10-digit validation for India
      if (selectedCountryCode === "91" && cleanPhone.length !== 12) {
        nicePrompt.error("Invalid Number", "Indian WhatsApp numbers must be exactly 10 digits (Excluding +91).");
        setLoading(false);
        return;
      }

      // General length validation
      if (cleanPhone.length < 8 || cleanPhone.length > 15) {
        nicePrompt.error("Invalid Number", "Phone number must be between 10 to 15 digits including country code.");
        setLoading(false);
        return;
      }

      const payload = {
        name: manualRecipientForm.name.trim(),
        phone: cleanPhone,
        countryCode: selectedCountryCode
      };

      if (editing) {
        const res = await api.post(`/campaign-numbers/${editing._id}/numbers`, payload);
        setManualRecipients(prev => [...prev, res.data.campaignNumber]);
      } else {
        // For new campaign, we use numeric phone for consistency
        setManualRecipients(prev => [...prev, {
          _id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: manualRecipientForm.name.trim() || null,
          phone: cleanPhone,
          source: "manual"
        }]);
      }

      setManualRecipientForm(prev => ({ ...prev, name: "", mobile: selectedCountryCode }));
    } catch (err) {
      nicePrompt.error("Error", err.response?.data?.error || "Failed to add recipient");
    } finally {
      setLoading(false);
    }
  };

  const removeManualRecipient = async (recipient) => {
    if (editing && recipient._id) {
      try {
        await api.delete(`/campaign-numbers/${editing._id}/numbers/${recipient._id}`);
        setManualRecipients(prev => prev.filter(r => r._id !== recipient._id));
      } catch (err) {
        console.error("Failed to remove recipient:", err);
        // If it's already 404, just filter the state and don't alert
        if (err.response?.status === 404) {
          setManualRecipients(prev => prev.filter(r => r._id !== recipient._id));
        } else {
          alert("Failed to remove recipient");
        }
      }
    } else {
      setManualRecipients(prev => prev.filter(r => r._id !== recipient._id));
    }
  };

  /* ---------------- CSV HANDLERS ---------------- */
  const handleCsvUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert("Please select a valid CSV file");
      return;
    }

    setCsvState(prev => ({ ...prev, file, isUploading: true }));

    try {
      const formData = new FormData();
      formData.append('csv', file);
      formData.append('countryCode', selectedCountryCode); // Send country code for normalization

      let res;
      if (editing) {
        res = await api.post(`/campaign-numbers/${editing._id}/import-csv`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        // Reload numbers
        await loadCampaignNumbers(editing._id);
      } else {
        // For new campaign, parse locally (simplified)
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

        const phoneIndex = headers.indexOf('phone');
        if (phoneIndex === -1) {
          throw new Error("CSV must have 'phone' column");
        }

        const parsedNumbers = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(col => col.trim().replace(/"/g, ''));
          if (cols.length > phoneIndex) {
            let rawPhone = cols[phoneIndex];
            if (!rawPhone) continue;

            // Robust cleaning
            let phone = rawPhone.replace(/\D/g, '');

            // Apply country prefix if it's too short
            if (phone.length < 10) {
              const prefix = selectedCountryCode.replace(/\D/g, '');
              if (!phone.startsWith(prefix)) {
                phone = prefix + phone;
              }
            }

            // 🔥 Local Duplicate Check (Check both new list and existing state)
            const isDuplicate = parsedNumbers.some(n => n.phone === phone) ||
              manualRecipients.some(r => r.phone === phone);

            if (isDuplicate) continue;

            parsedNumbers.push({
              _id: `temp_csv_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
              name: cols[headers.indexOf('name')] || null,
              phone: phone,
              source: "csv"
            });
          }
        }

        // 🔥 APPEND instead of Replace
        setManualRecipients(prev => [...prev, ...parsedNumbers]);
        res = { data: { summary: { totalRows: lines.length - 1, imported: parsedNumbers.length, skipped: (lines.length - 1) - parsedNumbers.length } } };
      }

      setCsvState(prev => ({
        ...prev,
        importResult: res.data.summary,
        isUploading: false
      }));

    } catch (err) {
      alert(err.response?.data?.error || "Failed to import CSV");
      setCsvState(prev => ({ ...prev, isUploading: false }));
    }
  };

  const handleClearRecipients = async () => {
    if (!window.confirm("Are you sure you want to remove all imported/manual contacts?")) return;

    try {
      if (editing) {
        await api.delete(`/campaign-numbers/${editing._id}/clear-all`);
      }
      setManualRecipients([]);
      setCsvState(emptyCsvState);
    } catch (err) {
      console.error("Failed to clear recipients:", err);
      alert("Failed to clear recipients");
    }
  };

  /* ---------------- FORM SUBMISSION ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Campaign name is required");
      return;
    }

    // Phone Number ID is optional for creation, required for sending
    // if (!phoneNumberId) {
    //   alert("Please select a WhatsApp Business number");
    //   return;
    // }


    if (!form.template) {
      alert("Please select a template");
      return;
    }

    // Validate scheduledAt
    if (form.scheduledAt) {
      const scheduledDate = new Date(form.scheduledAt);
      if (scheduledDate <= new Date()) {
        alert("Scheduled time must be in the future");
        return;
      }
    }

    // Validate recipients based on source
    if (form.recipientSource === "group") {
      if (!selectedGroups.length) {
        alert("Please select at least one group");
        return;
      }
    } else if (form.recipientSource === "contacts") {
      if (!selectedContacts.length) {
        alert("Please select at least one contact");
        return;
      }
    } else if (form.recipientSource === "addNumber" || form.recipientSource === "importCsv") {
      if (!manualRecipients.length) {
        alert("Please add recipients from manual entry or CSV");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const submitData = {
        name: form.name.trim(),
        phoneNumberId,
        template: {
          metaTemplateName:
            form.template.metaTemplateName || form.template.name,
          language: form.template.language || "en_US",
          components: form.template.components || [],
          buttons: form.template.buttons || [],
          headerImageId: null, // Will be set by backend
          variables: form.variableTypes.map(v => v ? v.value : ""), // Derive properly from tracked state
          variableTypes: form.variableTypes.map(v => ({
            index: v ? v.index : null,
            type: v ? v.type : "static",
            value: v ? v.value : "",
          })),
          catalogThumbnailSku: form.catalogThumbnailSku || null,
        },

        recipientSource: form.recipientSource,
        groupIds: selectedGroups,
        contactIds: selectedContacts, // 🔥 Added
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        headerOverrideUrl: form.headerOverrideUrl,
        headerOverrideHandle: form.headerOverrideHandle,
        manualRecipients: manualRecipients, // ✅ FIX: Always send manual recipients for sync
      };

      let res;
      if (editing) {
        res = await api.put(`/campaigns/${editing._id}`, submitData);
      } else {
        res = await api.post("/campaigns", submitData);
      }

      onSaved?.();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save campaign");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------- TEMPLATE SELECTION ---------------- */
  const handleTemplateSelect = (template) => {
    setForm(prev => ({
      ...prev,
      template,
      headerOverrideUrl: "", // Reset overrides on new template select
      headerOverrideHandle: ""
    }));
    onHeaderOverrideChange?.(null);
    parseTemplateVariables(template);
    onTemplateSelect?.(template);
  };

  const hasImageHeader = form.template?.components?.some(c => c.type === "HEADER" && (c.format === "IMAGE" || c.format === "VIDEO")) ||
    form.template?.header?.type === "image";

  const [headerOverrideTab, setHeaderOverrideTab] = useState("url"); // url | upload
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const fileInputRef = useRef(null);

  const handleHeaderUrlChange = (url) => {
    console.log("🔗 Manual Header URL Change:", url);
    setForm(prev => ({ ...prev, headerOverrideUrl: url, headerOverrideHandle: "" }));
    onHeaderOverrideChange?.(url);
  };

  const handleHeaderFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploadingHeader(true);
    try {
      const formData = new FormData();
      formData.append('image', file); // ✅ Field name is "image" for Cloudinary route

      const res = await api.post('/upload/campaign', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && (res.data.url || res.data.imageUrl)) {
        const url = res.data.url || res.data.imageUrl;
        console.log("✅ Cloudinary Header Upload Success:", url);
        setForm(prev => ({ ...prev, headerOverrideUrl: url, headerOverrideHandle: "" }));
        onHeaderOverrideChange?.(url);
      }
    } catch (err) {
      console.error("Failed to upload header to Cloudinary:", err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setIsUploadingHeader(false);
    }
  };

  return (
    <div className="w-full space-y-10">
      {/* SECTION 1: CAMPAIGN DETAILS & HEADER */}
      <div className="relative z-50 bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 p-6 mt-1 transition-all">
        <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-5">
          <button
            onClick={(e) => { e.preventDefault(); if (onBack) onBack(); else navigate('/campaigns/whatsapp'); }}
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-500 hover:text-slate-900 transition-all shadow-sm z-10 relative cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4 pr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-[16px] font-bold text-slate-900 tracking-tight font-poppins">{editing ? "Edit Campaign" : "Create Campaign"}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 font-poppins">
              Campaign Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full h-10 px-4 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all text-[13px] font-bold text-slate-900 shadow-sm"
              placeholder="e.g. Summer Special 2024"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 font-poppins">
              Sending WhatsApp Number
            </label>
            <div className="relative group phone-dropdown">
              <button
                type="button"
                onClick={() => setPhoneSelectOpen(!phoneSelectOpen)}
                className={`w-full h-10 px-4 flex items-center justify-between bg-slate-50/50 border ${phoneSelectOpen ? 'border-blue-500 ring-4 ring-blue-500/10 bg-white' : 'border-slate-200 hover:border-slate-300'} rounded-xl outline-none transition-all text-[13px] font-bold shadow-sm cursor-pointer`}
              >
                <span className={phoneNumberId ? 'text-slate-900' : 'text-slate-400'}>
                  {phoneNumberId
                    ? (() => {
                      const waba = wabaNumbers.find(w => w.id === phoneNumberId);
                      return waba ? `${waba.display_phone_number} (WABA ID: ${waba.id})` : 'Choosing sending number...';
                    })()
                    : 'Choosing sending number...'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${phoneSelectOpen ? 'rotate-180 text-blue-500' : ''}`} />
              </button>

              {/* Dropdown Options */}
              {phoneSelectOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1">
                    <button
                      type="button"
                      onClick={() => { setPhoneNumberId(""); setPhoneSelectOpen(false); }}
                      className={`w-full flex items-center px-4 py-2.5 text-[13px] font-bold rounded-lg transition-colors ${!phoneNumberId ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Choosing sending number...
                    </button>
                    {wabaNumbers.map(waba => (
                      <button
                        key={waba.id}
                        type="button"
                        onClick={() => { setPhoneNumberId(waba.id); setPhoneSelectOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold rounded-lg transition-colors ${phoneNumberId === waba.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600'}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${phoneNumberId === waba.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                          <Zap size={12} />
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                          <span className="truncate">{waba.display_phone_number}</span>
                          <span className="text-[10px] font-semibold text-slate-400">WABA ID: {waba.id}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: MESSAGE CONFIGURATION */}
      <div className="relative z-40 bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 p-6 transition-all">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-sm border border-blue-100/50">
            <Zap size={14} />
          </div>
          <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-widest font-poppins">Message Configuration</h2>
        </div>

        {/* Template Selection */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-2">
            <label className="text-[14px] font-bold text-slate-700 ml-1 font-poppins">Select Template</label>
            <button
              type="button"
              onClick={() => navigate('/templates')}
              className="text-blue-600 hover:text-blue-700 font-bold transition-all text-[13px] underline decoration-blue-200 hover:decoration-blue-600 underline-offset-4"
            >
              Create New Template
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 group w-full">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search templates..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all text-[13px] font-bold text-slate-900 shadow-sm"
              />
            </div>

            <div className="relative w-full sm:w-[220px]">
              <div
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full h-10 px-4 flex items-center justify-between bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all text-[13px] font-bold text-slate-700 shadow-sm cursor-pointer"
              >
                <span>{templateCategoryFilter}</span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
              </div>
              
              {showCategoryDropdown && (
                <>
                  <div className="fixed inset-0 z-[90]" onClick={() => setShowCategoryDropdown(false)} />
                  <div className="absolute right-0 top-[calc(100%+8px)] w-full bg-white border border-slate-100 rounded-xl shadow-xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 p-1">
                    {["All Categories", "Marketing", "Utility"].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setTemplateCategoryFilter(cat);
                          setShowCategoryDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 text-[13px] font-bold rounded-lg transition-colors ${
                          templateCategoryFilter === cat 
                            ? "bg-blue-50 text-blue-700" 
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col max-h-[360px] overflow-y-auto border border-slate-200/80 rounded-xl bg-white shadow-sm custom-scrollbar">
            {/* List Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3.5 bg-slate-50/80 border-b border-slate-100 text-left sticky top-0 z-10 backdrop-blur-sm">
              <div className="col-span-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-poppins">Template Name</div>
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-poppins">Category</div>
              <div className="col-span-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-poppins">Content Preview</div>
            </div>

            {/* List Items */}
            <div className="divide-y divide-slate-100">
              {templates
                .filter(t => t.metaStatus === "approved")
                .filter(t => !templateSearch || t.name?.toLowerCase().includes(templateSearch.toLowerCase()))
                .filter(t => templateCategoryFilter === "All Categories" || t.category?.toLowerCase() === templateCategoryFilter.toLowerCase())
                .map(template => {
                  const isSelected = form.template?._id === template._id;
                  return (
                    <button
                      key={template._id}
                      type="button"
                      onClick={() => handleTemplateSelect(template)}
                      className={`grid grid-cols-12 gap-4 px-4 py-4 w-full text-left items-start transition-all group hover:bg-slate-50 cursor-pointer ${isSelected ? "bg-blue-50/40 relative" : "bg-white"
                        }`}
                    >
                      {/* Selection Indicator */}
                      {isSelected && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500 rounded-r-sm shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>}

                      <div className="col-span-4 flex items-start gap-3 min-w-0 pl-1">
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isSelected ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                          }`}>
                          <strong className="text-[12px] font-poppins">{template.name?.charAt(0).toUpperCase() || 'T'}</strong>
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={`text-[14px] font-semibold break-words leading-tight font-poppins transition-colors ${isSelected ? "text-blue-700" : "text-slate-800 group-hover:text-slate-900"}`}>
                            {template.name || template.metaTemplateName}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">
                            {template.language || 'EN_US'}
                          </span>
                        </div>
                      </div>

                      <div className="col-span-2 flex items-center pt-1">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-widest uppercase font-poppins border ${template.category?.toLowerCase() === 'marketing' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                          template.category?.toLowerCase() === 'utility' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                          {template.category || 'UTILITY'}
                        </span>
                      </div>

                      <div className="col-span-6 min-w-0 pt-1">
                        <p className="text-[13px] text-slate-500 line-clamp-3 leading-relaxed">
                          {template.body || template.components?.find(c => c.type === "BODY")?.text || "No content available"}
                        </p>
                      </div>
                    </button>
                  );
                })}

              {templates.filter(t => t.metaStatus === "approved").length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center">
                  <span className="text-3xl mb-3">🔍</span>
                  <span className="text-[13px] font-bold text-slate-400 font-poppins uppercase tracking-widest">No approved templates found</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- OVERRIDE HEADER IMAGE --- */}
        {hasImageHeader && (
          <div className="mt-12 animate-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50">
                  <ImageIcon size={20} />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-800 uppercase tracking-wider font-poppins leading-tight">Override Header Image</h3>
                  <p className="text-[11px] font-bold text-slate-400 tracking-tight uppercase mt-0.5">Template Uses: <span className="text-blue-500">IMAGE HEADER</span></p>
                </div>
              </div>

              {(form.headerOverrideUrl || form.headerOverrideHandle) && (
                <button
                  type="button"
                  onClick={() => {
                    setForm(prev => ({ ...prev, headerOverrideUrl: "", headerOverrideHandle: "" }));
                    onHeaderOverrideChange?.(null);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-all border border-transparent hover:border-rose-100 uppercase tracking-tight"
                >
                  <Trash2 size={13} />
                  Reset to Default
                </button>
              )}
            </div>

            <div className="bg-slate-50/50 border border-slate-200/60 rounded-3xl p-6 relative overflow-hidden group">
              {/* Tab Navigation */}
              <div className="flex gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => setHeaderOverrideTab("url")}
                  className={`px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all flex items-center gap-2 ${headerOverrideTab === "url"
                    ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:bg-slate-100"
                    }`}
                >
                  <Link size={14} />
                  Image URL
                </button>
                <button
                  type="button"
                  onClick={() => setHeaderOverrideTab("upload")}
                  className={`px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all flex items-center gap-2 ${headerOverrideTab === "upload"
                    ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:bg-slate-100"
                    }`}
                >
                  <Upload size={14} />
                  Direct Upload
                </button>
              </div>

              {/* URL Input */}
              {headerOverrideTab === "url" && (
                <div className="relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-focus-within/input:text-blue-500 transition-all">
                    <Link size={14} />
                  </div>
                  <input
                    type="text"
                    value={form.headerOverrideUrl}
                    onChange={(e) => handleHeaderUrlChange(e.target.value)}
                    placeholder="Paste image URL here (e.g. https://example.com/image.jpg)"
                    className="w-full h-12 pl-16 pr-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-[13px] font-semibold text-slate-700 shadow-inner"
                  />
                </div>
              )}

              {/* Upload Input */}
              {headerOverrideTab === "upload" && (
                <div
                  onClick={() => !isUploadingHeader && fileInputRef.current?.click()}
                  className={`h-[100px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${form.headerOverrideUrl
                    ? "bg-emerald-50/30 border-emerald-200/50 hover:bg-emerald-50/50"
                    : "bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/20"
                    }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleHeaderFileUpload}
                    className="hidden"
                    accept="image/*"
                  />

                  {isUploadingHeader ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[13px] font-bold text-slate-500 animate-pulse">Uploading Image...</span>
                    </div>
                  ) : form.headerOverrideUrl ? (
                    <>
                      <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                        <ImageIcon size={18} />
                      </div>
                      <span className="text-[13px] font-bold text-emerald-600 uppercase tracking-tight">Successfully Uploaded</span>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                        <Upload size={20} />
                      </div>
                      <span className="text-[13px] font-bold text-slate-400 group-hover:text-slate-600 transition-all">Click to upload campaign image</span>
                    </>
                  )}
                </div>
              )}

              <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 leading-relaxed">
                This image will be sent as the header for all recipients in this campaign.
              </p>
            </div>
          </div>
        )}

        {/* Map Variables Section */}
        {parsedVariables.length > 0 && (
          <div className="mt-12 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-3 text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z M9 12h6 M12 9v6" />
                </svg>
                <h3 className="text-[14px] font-bold uppercase tracking-wider">Map Variables</h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  const currentValues = parsedVariables.map(v => v.value || "").join('\n');
                  setPasteValue(currentValues);
                  setShowPasteModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 text-[11px] font-bold rounded-lg hover:bg-blue-600 hover:text-white transition-all uppercase tracking-tight shadow-sm"
              >
                <span>🪄</span> Auto Fill body variables
              </button>
            </div>

            {/* Automation Floating Modal */}
            {showPasteModal && createPortal(
              <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowPasteModal(false)} />
                <div className="relative bg-white w-full max-w-[450px] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <span className="text-[14px] font-bold text-slate-700 uppercase tracking-widest">Bulk Paste Variables</span>
                    <button
                      type="button"
                      onClick={() => setShowPasteModal(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-8 space-y-6">
                    <textarea
                      autoFocus
                      value={pasteValue}
                      onChange={(e) => setPasteValue(e.target.value)}
                      placeholder={`Paste content here...\nLine 1 for {{1}}\nLine 2 for {{2}}`}
                      className="w-full h-[180px] p-4 text-[13px] border border-slate-200 rounded-2xl focus:ring-0 focus:border-blue-500 outline-none resize-none bg-slate-50/50 font-medium"
                    />
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 text-[13px] text-slate-600 cursor-pointer group">
                        <input type="checkbox" checked={skipExtraLines} onChange={e => setSkipExtraLines(e.target.checked)} className="rounded border-slate-300 text-blue-600 w-4 h-4 shadow-sm focus:ring-blue-500" />
                        <span className="group-hover:text-slate-900 transition-colors">Skip Extra Lines</span>
                      </label>
                      <label className="flex items-center gap-3 text-[13px] text-slate-600 cursor-pointer group">
                        <input type="checkbox" checked={mergeRemaining} onChange={e => setMergeRemaining(e.target.checked)} className="rounded border-slate-300 text-blue-600 w-4 h-4 shadow-sm focus:ring-blue-500" />
                        <span className="group-hover:text-slate-900 transition-colors">Merge Remaining into Last Variable</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={applyBulkPaste}
                      className="w-full bg-blue-600 hover:bg-black text-white font-bold py-4 rounded-2xl text-[14px] shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                    >
                      Apply Auto-fill
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}



            <div className="bg-slate-50 rounded-2xl border border-slate-200/60 overflow-hidden">
              {/* 🔥 CATALOG FEATURED PRODUCT (CAMPAIGN LEVEL) */}
              {form.template?.buttons?.some(b => b.type === 'CATALOG') && (
                <div className="p-6 bg-emerald-50/50 border-b border-emerald-100 animate-in fade-in zoom-in duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                      <Zap size={18} />
                    </div>
                    <div>
                      <h4 className="text-[14px] font-bold text-emerald-700 uppercase tracking-widest leading-none">Catalog Mapping</h4>
                      <p className="text-[10px] font-bold text-emerald-600/60 uppercase mt-1">Select thumbnail product</p>
                    </div>
                  </div>

                  <div className="relative">
                    <select
                      value={form.catalogThumbnailSku}
                      onChange={(e) => setForm(prev => ({ ...prev, catalogThumbnailSku: e.target.value }))}
                      className="w-full h-12 px-5 text-[14px] font-bold border border-emerald-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all bg-white shadow-sm appearance-none cursor-pointer"
                    >
                      <option value="">{inventoryProducts.length === 0 ? "No synced products found (Check Commerce Sync)" : "Select a product from your inventory..."}</option>
                      {inventoryProducts.map((prod) => (
                        <option key={prod.sku} value={prod.sku}>
                          {prod.name} (SKU: {prod.sku}) - ₹{(prod.price / 100).toFixed(2)}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] text-emerald-600/70 font-semibold italic flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-emerald-400 rounded-full"></span>
                    {inventoryProducts.length === 0
                      ? "⚠️ You must sync products to Meta Catalog before using them in templates."
                      : "WhatsApp requirement: All recipients will see this product as the catalog cover."}
                  </p>
                </div>
              )}

              <div className="divide-y divide-slate-200/60">
                {parsedVariables.map((variable) => (
                  <div key={variable.index} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 hover:bg-white transition-colors">
                    <div className="w-24 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-[13px] font-bold text-blue-600 shadow-sm">
                      {"{{" + variable.index + "}}"}
                    </div>

                    <div className="flex-1 flex flex-col sm:flex-row gap-4 w-full">
                      <select
                        value={variable.type}
                        onChange={(e) => updateVariable(variable.index, "type", e.target.value)}
                        className="w-full sm:w-48 h-10 px-4 border border-slate-200 rounded-xl text-[13px] font-semibold bg-white outline-none focus:border-blue-500 transition-all"
                      >
                        <option value="static">Static Value</option>
                        <option value="dynamic">Dynamic Value</option>
                      </select>

                      {variable.type === "static" ? (
                        <input
                          type="text"
                          value={variable.value}
                          onChange={(e) => updateVariable(variable.index, "value", e.target.value)}
                          placeholder={`Enter manual value for {{${variable.index}}}`}
                          className="flex-1 h-10 px-4 border border-slate-200 rounded-xl text-[13px] font-semibold bg-white outline-none focus:border-blue-500 transition-all"
                        />
                      ) : (
                        <div className="flex-1 relative group">
                          <select
                            value={variable.value}
                            onChange={(e) => updateVariable(variable.index, "value", e.target.value)}
                            className="w-full h-10 px-4 pr-10 border border-slate-200 rounded-xl text-[13px] font-semibold bg-white outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                          >
                            <option value="">Select Data Source...</option>
                            <option value="name">Recipient Name</option>
                            <option value="phone">Recipient Phone</option>
                            <option value="custom">Custom Field</option>
                          </select>
                          <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: RECIPIENT SELECTION */}
      <div className="relative z-30 bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 p-6 transition-all">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-sm border border-blue-100/50">
            <Users size={14} />
          </div>
          <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-widest font-poppins">
            {activeTab === "group" ? (showContactsInGroups ? "Select Individual Contacts" : "Select Contact Groups") : activeTab === "addNumber" ? "Add Manual Numbers" : "Import CSV Contacts"}
          </h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 mb-8 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
          {[
            { id: "group", label: "Groups & Contacts", icon: "👥" },
            { id: "addNumber", label: "Add Numbers", icon: "📱" },
            { id: "importCsv", label: "Import CSV", icon: "📄" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 text-[14px] font-bold rounded-xl transition-all duration-200 ${activeTab === tab.id
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-slate-600 hover:text-blue-600 hover:bg-white"
                }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {/* Group Tab */}
          {activeTab === "group" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50">
                <div className="space-y-1">
                  <p className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
                    {showContactsInGroups ? "Selected Contacts" : "Selected Groups"}
                    <span className="w-6 h-6 bg-blue-600 text-white text-[12px] rounded-full flex items-center justify-center font-bold shadow-sm">
                      {showContactsInGroups ? selectedContacts.length : selectedGroups.length}
                    </span>
                  </p>
                  <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">
                    {showContactsInGroups ? "Targeting individual customers" : `${groups.filter(g => selectedGroups.includes(g._id.toString())).reduce((acc, g) => acc + (g.contactIds?.length || 0), 0)} Total Contacts across all groups`}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  {/* View Toggle */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-blue-100 shadow-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setShowContactsInGroups(false);
                        setForm(prev => ({ ...prev, recipientSource: "group" }));
                      }}
                      className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${!showContactsInGroups ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      Groups
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowContactsInGroups(true);
                        setForm(prev => ({ ...prev, recipientSource: "contacts" }));
                      }}
                      className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${showContactsInGroups ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      Contacts
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (showContactsInGroups) {
                        if (selectedContacts.length === allContacts.length) setSelectedContacts([]);
                        else setSelectedContacts(allContacts.map(c => c._id.toString()));
                      } else {
                        if (selectedGroups.length === groups.length) setSelectedGroups([]);
                        else setSelectedGroups(groups.map(g => g._id.toString()));
                      }
                    }}
                    className="px-5 py-2 bg-white border border-blue-200 text-blue-600 text-[12px] font-bold rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                  >
                    {showContactsInGroups
                      ? (selectedContacts.length === allContacts.length ? "Deselect All" : "Select All Contacts")
                      : (selectedGroups.length === groups.length ? "Deselect All" : "Select All Groups")
                    }
                  </button>
                </div>
              </div>

              {!showContactsInGroups ? (
                /* Group List */
                groups.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <div className="text-4xl mb-4">📭</div>
                    <p className="text-[14px] font-bold text-slate-500">No contact groups found</p>
                    <p className="text-[12px] text-slate-400 mt-1">Create groups in the Contacts section first</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative group">
                      <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search groups by name..."
                        value={groupSearch}
                        onChange={(e) => setGroupSearch(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all text-[13px] font-bold text-slate-900 shadow-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar p-1">
                      {groups
                        .filter(group => group.name.toLowerCase().includes(groupSearch.toLowerCase()))
                        .map(group => (
                          <button
                            key={group._id}
                            type="button"
                            onClick={() => toggleGroup(group._id)}
                            className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group/card w-full min-h-[56px] flex flex-col justify-center ${selectedGroups.includes(group._id.toString())
                              ? "border-blue-500 bg-blue-50/40"
                              : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                              }`}
                          >
                            {/* Selection Marker */}
                            {selectedGroups.includes(group._id.toString()) && (
                              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]"></div>
                            )}
                            <div className="flex items-center justify-between gap-4 w-full">
                              <div className="flex items-center gap-4 py-1">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${selectedGroups.includes(group._id.toString())
                                  ? "border-blue-600 bg-blue-600 shadow-sm"
                                  : "border-slate-300 bg-white group-hover/card:border-blue-400"
                                  }`}>
                                  {selectedGroups.includes(group._id.toString()) && (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <div className="text-[13px] font-bold text-slate-800 truncate tracking-tight">{group.name}</div>
                              </div>
                              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shrink-0 shadow-sm border ${selectedGroups.includes(group._id.toString()) ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                <Users className="w-3 h-3" strokeWidth={3} />
                                {group.membersCount || group.contactIds?.length || 0} PROFILES
                              </div>
                            </div>

                            {/* Subtle background accent for selected */}
                            {selectedGroups.includes(group._id.toString()) && (
                              <div className="absolute top-0 right-0 w-16 h-full bg-blue-500/5 -mr-4 skew-x-12 blur-xl pointer-events-none"></div>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                )
              ) : (
                /* Contact List */
                <div className="space-y-6">
                  <div className="relative group">
                    <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search contacts by name or number..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all text-[13px] font-bold text-slate-900 shadow-sm"
                    />
                  </div>

                  {contactsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Loading contacts list...</p>
                    </div>
                  ) : allContacts.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <div className="text-4xl mb-4">👤</div>
                      <p className="text-[14px] font-bold text-slate-500">No contacts found</p>
                      <p className="text-[12px] text-slate-400 mt-1">Add contacts in the directory first</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar p-1">
                      {allContacts
                        .filter(c => !contactSearch ||
                          c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
                          c.phone?.includes(contactSearch))
                        .map((contact) => {
                          const isSelected = selectedContacts.includes(contact._id.toString());
                          return (
                            <button
                              key={contact._id}
                              type="button"
                              onClick={() => {
                                const id = contact._id.toString();
                                setSelectedContacts(prev =>
                                  prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
                                );
                              }}
                              className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group relative w-full ${isSelected
                                ? "border-blue-500 bg-blue-50/30"
                                : "border-slate-100 bg-white hover:border-blue-200 hover:bg-slate-50/50"
                                }`}
                            >
                              {/* Selection Marker */}
                              {isSelected && (
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]"></div>
                              )}

                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold transition-all shrink-0 ${isSelected ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600"
                                }`}>
                                {contact.name?.charAt(0).toUpperCase() || "C"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[14px] font-bold truncate tracking-tight ${isSelected ? "text-blue-800" : "text-slate-800"}`}>
                                  {contact.name || "Unknown"}
                                </p>
                                <p className={`text-[11px] font-semibold ${isSelected ? "text-blue-600/70" : "text-slate-400"}`}>
                                  {contact.phone?.startsWith('+') ? contact.phone : `+${contact.phone}`}
                                </p>
                              </div>

                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${isSelected
                                ? "border-blue-600 bg-blue-600 shadow-sm"
                                : "border-slate-200 bg-white group-hover:border-blue-400"
                                }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Add Number Tab */}
          {activeTab === "addNumber" && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="text-[15px] font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <span>📱</span> Add Recipients Manually
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-[13px] font-bold text-slate-600 mb-2 ml-1">
                      Recipient Name <span className="text-slate-400 font-medium">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={manualRecipientForm.name}
                      onChange={(e) => setManualRecipientForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full h-11 px-5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all text-[14px] font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-bold text-slate-600 mb-2 ml-1">
                      WhatsApp Number <span className="text-rose-500">*</span>
                    </label>
                    <PhoneInput
                      country={defaultCountry}
                      value={manualRecipientForm.mobile}
                      onChange={(value, country) => {
                        setManualRecipientForm(prev => ({ ...prev, mobile: value }));
                        setSelectedCountryCode(country.dialCode);
                        setDefaultCountry(country.countryCode);
                      }}
                      containerClass="!w-full"
                      inputClass="!w-full !h-11 !rounded-xl !border-slate-200 !text-[14px] !font-semibold focus:!border-blue-500 transition-all"
                      buttonClass="!rounded-l-xl !border-slate-200 !bg-white"
                      placeholder="Enter full number"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-slate-200/60 pt-6">
                  <p className="text-[12px] font-semibold text-slate-400 italic">
                    * Numbers will be normalized automatically.
                  </p>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {manualRecipients.length > 0 && (
                      <button
                        onClick={handleClearRecipients}
                        className="px-6 py-2.5 bg-white border border-rose-100 text-rose-500 font-bold rounded-xl hover:bg-rose-50 transition-all shadow-sm active:scale-95"
                      >
                        Clear All
                      </button>
                    )}
                    <button
                      onClick={addManualRecipient}
                      disabled={loading || !manualRecipientForm.mobile.trim()}
                      className="flex-1 sm:flex-none px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-black disabled:opacity-50 transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Adding...
                        </>
                      ) : (
                        <>
                          <span className="text-lg">+</span>
                          Add Recipient
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Unified Recipients List (Show for both manual and CSV tabs) */}
          {(activeTab === "addNumber" || activeTab === "importCsv") && (
            <div className="mt-8 space-y-6">
              {(activeTab === "importCsv" && manualRecipients.some(r => r.source === 'csv')) && (
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                      📄
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-slate-900">Active CSV Import</p>
                      <p className="text-[12px] font-semibold text-emerald-600">
                        {manualRecipients.filter(r => r.source === 'csv').length} recipients loaded from your imported file
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClearRecipients}
                    className="px-4 py-2 bg-white border border-rose-200 text-rose-500 text-[12px] font-bold rounded-xl hover:bg-rose-50 transition-all shadow-sm"
                  >
                    Clear All Imported
                  </button>
                </div>
              )}

              {manualRecipients.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-3">
                      📋 Campaign Targets
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[11px] font-black rounded-lg uppercase tracking-wider border border-blue-100">
                        {manualRecipients.length} profiles
                      </span>
                    </h3>
                    {activeTab === "addNumber" && (
                      <button
                        onClick={handleClearRecipients}
                        className="text-[12px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1.5 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear All
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar p-1">
                    {manualRecipients.map((recipient) => (
                      <div key={recipient.phone + recipient._id} className="group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 relative overflow-hidden">
                        {recipient.source === 'csv' && (
                          <div className="absolute top-0 right-0 py-1 px-2 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-lg">
                            CSV
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-[16px] font-bold shrink-0 transition-transform group-hover:scale-110 shadow-sm ${recipient.source === 'csv' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                            {recipient.name ? recipient.name.charAt(0).toUpperCase() : '👤'}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[14px] font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{recipient.name || "Unnamed"}</div>
                            <div className="text-[12px] font-bold text-slate-400">
                              {recipient.phone?.startsWith('+') ? recipient.phone : `+${recipient.phone}`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeManualRecipient(recipient)}
                          className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-90 shrink-0"
                          title="Remove recipient"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import CSV Tab */}
          {activeTab === "importCsv" && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="mb-6 flex flex-col sm:flex-row items-end gap-6">
                  <div className="w-full sm:w-[140px]">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Country Prefix</label>
                    <div className="relative group/picker">
                      <PhoneInput
                        country={defaultCountry}
                        value={selectedCountryCode}
                        onChange={(value, country) => {
                          setSelectedCountryCode(country.dialCode);
                          setDefaultCountry(country.countryCode);
                        }}
                        containerClass="!w-full"
                        inputClass="!w-full !h-10 !rounded-xl !border-slate-200 !text-[12px] !font-bold !bg-white focus:!border-blue-500 transition-all !cursor-default !pl-12"
                        buttonClass="!rounded-l-xl !border-slate-200 !bg-white !w-10"
                        inputProps={{
                          readOnly: true,
                          placeholder: "Pick..."
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const csvContent = "name,phone\nJohn Doe,919876543210\nJane Smith,910123456789";
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement("a");
                      const url = URL.createObjectURL(blob);
                      link.setAttribute("href", url);
                      link.setAttribute("download", "sample_contacts.csv");
                      link.style.visibility = 'hidden';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl text-[12px] font-bold hover:bg-blue-100 transition-all shadow-sm mb-0.5"
                  >
                    <Upload size={14} className="rotate-180" />
                    Download Sample CSV
                  </button>
                </div>

                <div className="relative border-2 border-dashed border-slate-200 rounded-[28px] p-12 text-center hover:border-blue-400 hover:bg-white transition-all group bg-slate-50/50">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    id="csv-upload"
                  />
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-[20px] flex items-center justify-center text-2xl mb-4 transition-transform group-hover:scale-110 shadow-inner">
                      📄
                    </div>
                    <div className="text-lg font-bold text-slate-900 mb-2">
                      {csvState.file ? csvState.file.name : "Select CSV file"}
                    </div>
                    <p className="text-[13px] font-semibold text-slate-500 max-w-xs mx-auto leading-relaxed">
                      File must have a <code className="bg-white px-1.5 py-0.5 rounded-lg border border-slate-200 text-blue-600 font-bold">phone</code> column.
                    </p>
                  </div>
                </div>

                {csvState.importResult && (
                  <div className="mt-8 p-6 bg-emerald-50 border border-emerald-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between gap-3 text-emerald-700 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">✓</div>
                        <span className="font-bold text-[14px]">Import Completed Successfully</span>
                      </div>
                      <button
                        onClick={handleClearRecipients}
                        className="px-4 py-1.5 bg-white border border-emerald-200 text-rose-500 text-[12px] font-bold rounded-xl hover:bg-rose-50 transition-all shadow-sm"
                      >
                        Remove Imported File
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-50">
                        <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">Total</div>
                        <div className="text-xl font-bold text-slate-900">{csvState.importResult.totalRows}</div>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-50">
                        <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">Imported</div>
                        <div className="text-xl font-bold text-emerald-600">{csvState.importResult.imported}</div>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-50">
                        <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">Skipped</div>
                        <div className="text-xl font-bold text-rose-500">{csvState.importResult.skipped}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: SCHEDULE & DELIVERY */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/50 p-6 transition-all hover:shadow-md">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-sm border border-blue-100/50">
            <Clock size={14} />
          </div>
          <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-widest font-poppins">Schedule & Delivery</h2>
        </div>

        <div className="space-y-8">
          {/* Scheduling Tabs */}
          <div className="flex p-1.5 bg-slate-50 rounded-2xl border border-slate-200/60 w-full sm:w-[480px]">
            <button
              onClick={() => {
                setForm(prev => ({ ...prev, scheduledAt: "" }));
              }}
              className={`flex-1 flex items-center justify-center gap-3 px-6 py-3 rounded-xl text-[14px] font-bold transition-all ${!form.scheduledAt
                ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-900"
                }`}
            >
              <Zap size={16} />
              Send Immediately
            </button>
            <button
              onClick={() => {
                if (!form.scheduledAt) {
                  const now = new Date();
                  now.setHours(now.getHours() + 1);
                  setForm(prev => ({ ...prev, scheduledAt: now.toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16) }));
                }
              }}
              className={`flex-1 flex items-center justify-center gap-3 px-6 py-3 rounded-xl text-[14px] font-bold transition-all ${form.scheduledAt
                ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-900"
                }`}
            >
              <Clock size={16} />
              Schedule for Later
            </button>
          </div>

          {form.scheduledAt && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-white border border-blue-100 rounded-2xl shadow-sm animate-in zoom-in-95 duration-300 relative overflow-visible group">
              {/* Background Glow */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors duration-700" />

              <div className="relative space-y-3">
                <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                  <Calendar size={12} className="text-blue-500" />
                  Launch Date
                </label>
                <CustomDatePicker
                  value={form.scheduledAt ? form.scheduledAt.split('T')[0] : ""}
                  onChange={(newDateStr) => {
                    const timeStr = (form.scheduledAt || "T00:00").split('T')[1] || "00:00";
                    setForm(prev => ({ ...prev, scheduledAt: `${newDateStr}T${timeStr}` }));
                  }}
                />
              </div>

              <div className="relative space-y-3">
                <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                  <Clock size={12} className="text-blue-500" />
                  Launch Time
                </label>
                <CustomTimePicker
                  value={form.scheduledAt ? form.scheduledAt.split('T')[1].slice(0, 5) : ""}
                  onChange={(newTimeStr) => {
                    const dateStr = (form.scheduledAt || "2000-01-01T").split('T')[0] || "2000-01-01";
                    setForm(prev => ({ ...prev, scheduledAt: `${dateStr}T${newTimeStr}` }));
                  }}
                />
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-2xl flex items-start gap-4 shadow-sm">
            <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-600 shrink-0 shadow-inner">
              <Clock size={20} />
            </div>
            <div className="space-y-1 py-0.5">
              <p className="text-[13px] font-bold text-slate-900 leading-tight">
                {form.scheduledAt
                  ? `Campaign scheduled for ${new Date(form.scheduledAt).toLocaleDateString()} at ${new Date(form.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : "Campaign will start sending immediately after launch."}
              </p>
              <p className="text-[12px] font-medium text-slate-500 leading-relaxed max-w-2xl">
                Please ensure your budget covers the expected volume of messages across your target audience.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex justify-end pt-4 pb-12">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="h-14 px-12 bg-blue-600 text-white rounded-2xl text-[16px] font-bold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-3 shadow-xl shadow-blue-500/20 active:scale-95 group"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Zap size={20} fill="currentColor" />
          )}
          <span>{editing ? "Update Campaign" : "Launch Campaign"}</span>
        </button>
      </div>
    </div>
  );
}
