import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RichTextEditor from './RichTextEditor';
import api from '../../api/api';
import {
  FiUser,
  FiUsers,
  FiUpload,
  FiSend,
  FiEdit2,
  FiChevronDown,
  FiCheck
} from 'react-icons/fi';
import {
  FiMail,
  FiPlus,
  FiX,
  FiTrash2,
  FiDownload,
  FiFileText,
  FiCalendar,
  FiClock
} from "react-icons/fi";

/* ---------------- RECIPIENT SELECTION COMPONENTS ---------------- */

const ManualRecipients = ({ recipients, onChange, onAdd, onRemove }) => {
  const [newEmail, setNewEmail] = useState({ email: "", name: "" });

  const handleAdd = () => {
    if (newEmail.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.email)) {
      onAdd({ ...newEmail, variables: {} });
      setNewEmail({ email: "", name: "" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Name (optional)"
          value={newEmail.name}
          onChange={(e) => setNewEmail({ ...newEmail, name: e.target.value })}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <input
          type="email"
          placeholder="Email address"
          value={newEmail.email}
          onChange={(e) => setNewEmail({ ...newEmail, email: e.target.value })}
          onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiPlus className="w-4 h-4" />
        </button>
      </div>

      {recipients.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {recipients.map((recipient, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">{recipient.name || 'No name'}</div>
                <div className="text-sm text-gray-600">{recipient.email}</div>
              </div>
              <button
                onClick={() => onRemove(index)}
                className="text-red-600 hover:text-red-800 transition-colors"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const GroupRecipients = ({ selectedGroups, groups, onChange }) => {
  const handleGroupToggle = (groupId) => {
    const updated = selectedGroups.includes(groupId)
      ? selectedGroups.filter(id => id !== groupId)
      : [...selectedGroups, groupId];
    onChange(updated);
  };

  const getTotalEmails = () => {
    return selectedGroups.reduce((total, groupId) => {
      const group = groups.find(g => g._id === groupId);
      return total + (group?.emailCount || 0);
    }, 0);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
        {Array.isArray(groups) && groups.map((group) => (
          <label
            key={group._id}
            className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedGroups.includes(group._id)}
              onChange={() => handleGroupToggle(group._id)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">{group.name}</div>
              <div className="text-sm text-gray-600">{group.emailCount} emails</div>
            </div>
          </label>
        ))}
      </div>

      {selectedGroups.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700">
            <FiCheck className="w-4 h-4" />
            <span className="font-medium">
              {selectedGroups.length} group{selectedGroups.length > 1 ? 's' : ''} selected
            </span>
            <span className="text-blue-600">•</span>
            <span>{getTotalEmails()} total emails</span>
          </div>
        </div>
      )}
    </div>
  );
};

const ImportRecipients = ({ importData, onUpload, onClear }) => {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/email-campaigns/upload-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      onUpload(res.data.data);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload CSV');
    } finally {
      setUploading(false);
    }
  };

  const downloadSample = () => {
    const csvContent = "name,email,tags\nJohn Doe,john@example.com,vip,lead\nJane Smith,jane@example.com,customer";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-emails.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {!importData ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <FiUpload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Upload CSV File</h3>
          <p className="text-gray-600 mb-4">Import emails from a CSV file</p>

          <div className="flex justify-center gap-3">
            <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
              {uploading ? 'Uploading...' : 'Choose File'}
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>

            <button
              onClick={downloadSample}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FiDownload className="w-4 h-4 inline mr-2" />
              Sample CSV
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-blue-700">
              <FiCheck className="w-5 h-5" />
              <span className="font-medium">CSV Imported Successfully</span>
            </div>
            <button
              onClick={onClear}
              className="text-blue-600 hover:text-blue-800 transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-700">{importData.stats.total}</div>
              <div className="text-xs text-blue-600">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-700">{importData.stats.valid}</div>
              <div className="text-xs text-blue-600">Valid</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-700">{importData.stats.skipped}</div>
              <div className="text-xs text-yellow-600">Skipped</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-700">{importData.stats.errors}</div>
              <div className="text-xs text-red-600">Errors</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EmailPreview = ({ template, subject, fromName, fromEmail, inlineEditMode, inlineTemplateContent, onInlineContentChange, onInlineSave, onInlineCancel }) => {
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    const content = inlineEditMode ? inlineTemplateContent : template?.htmlBody;
    if (content) {
      let html = content;
      html = html.replace(/\{\{subject\}\}/g, subject || 'Your Subject Here');
      html = html.replace(/\{\{fromName\}\}/g, fromName || 'Your Name');
      html = html.replace(/\{\{fromEmail\}\}/g, fromEmail || 'your@email.com');
      setPreviewHtml(html);
    }
  }, [template, subject, fromName, fromEmail, inlineEditMode, inlineTemplateContent]);

  if (!template) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center p-6">
          <FiFileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Template Selected</h3>
          <p className="text-gray-500 text-sm">Choose an email template to see the live preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ height: '600px' }}>
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-sm">
            {inlineEditMode ? 'Edit Template' : 'Email Preview'}
          </h3>
          <div className="flex items-center gap-2">
            {inlineEditMode ? (
              <>
                <button
                  type="button"
                  onClick={onInlineSave}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={onInlineCancel}
                  className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                {template.name}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1 text-xs text-gray-600">
          <div><strong>From:</strong> {fromName || 'Your Name'} &lt;{fromEmail || 'your@email.com'}&gt;</div>
          <div><strong>Subject:</strong> {subject || 'Your Subject Line'}</div>
        </div>
      </div>

      <div className="flex-1 bg-white overflow-hidden">
        {inlineEditMode ? (
          <textarea
            value={inlineTemplateContent}
            onChange={(e) => onInlineContentChange(e.target.value)}
            className="w-full h-full p-4 font-mono text-sm border-0 resize-none focus:outline-none"
            placeholder="Enter HTML template content..."
          />
        ) : (
          <iframe
            srcDoc={`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    body { 
                      margin: 0; 
                      padding: 20px; 
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                      line-height: 1.6;
                      color: #333;
                      background: #fff;
                      height: 100%;
                      box-sizing: border-box;
                    }
                    img { max-width: 100%; height: auto; }
                    table { border-collapse: collapse; }
                    td, th { padding: 8px; border: 1px solid #ddd; }
                  </style>
                </head>
                <body>
                  ${previewHtml}
                </body>
              </html>
            `}
            className="w-full h-full"
            title="Email Preview"
          />
        )}
      </div>
    </div>
  );
};

/* ---------------- MAIN COMPONENT ---------------- */
function EmailCampaignForm({ editing, onSaved, onCancel }) {
  /* ... */
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [smtpConfig, setSmtpConfig] = useState(null);
  const [loadingSmtp, setLoadingSmtp] = useState(true);
  const [groups, setGroups] = useState([]);
  const [importData, setImportData] = useState(null);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [inlineEditMode, setInlineEditMode] = useState(false);
  const [inlineTemplateContent, setInlineTemplateContent] = useState('');

  const [form, setForm] = useState({
    name: "",
    subject: "",
    fromEmail: "",
    fromName: "",
    replyTo: "",
    templateId: "",
    recipientType: "manual",
    recipientEmails: [],
    selectedGroups: [],
    importBatchId: null,
    scheduledAt: ""
  });

  // Load templates, groups, and SMTP config
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load SMTP config first
        try {
          const smtpRes = await api.get('/email/smtp/campaign-config');
          if (smtpRes.data.success) {
            setSmtpConfig(smtpRes.data.data);
            // Auto-fill form with SMTP config
            setForm(prev => ({
              ...prev,
              fromEmail: smtpRes.data.data.fromEmail || '',
              fromName: smtpRes.data.data.fromName || ''
            }));
          }
        } catch (smtpError) {
          console.warn('SMTP not configured:', smtpError.response?.data?.message);
        } finally {
          setLoadingSmtp(false);
        }

        const [templatesRes, groupsRes] = await Promise.all([
          api.get('/email-templates'), // Use consistent format
          api.get('/email-campaigns/email-groups')
        ]);

        // Handle templates response - consistent format: { success: true, data: [templates] }
        let templatesData = [];
        if (templatesRes.data.success && Array.isArray(templatesRes.data.data)) {
          templatesData = templatesRes.data.data;
        }

        setTemplates(templatesData);

        // Handle groups response
        let groupsData = [];
        if (groupsRes.data.success) {
          groupsData = Array.isArray(groupsRes.data.data) ? groupsRes.data.data : [];
        }
        setGroups(groupsData);

      } catch (error) {
        console.error('❌ Load data error:', error);
        // Ensure arrays even on error
        setTemplates([]);
        setGroups([]);
      }
    };

    loadData();
  }, [refreshKey]); // Refresh when refreshKey changes

  // Refresh templates when page gets focus (user returns from template editing)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Refresh templates when page becomes visible
        setRefreshKey(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showTemplateDropdown && !event.target.closest('.template-dropdown')) {
        setShowTemplateDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTemplateDropdown]);

  // Load editing data
  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name || "",
        subject: editing.subject || "",
        fromEmail: editing.fromEmail || "",
        fromName: editing.fromName || "",
        replyTo: editing.replyTo || "",
        templateId: editing.templateId?._id || editing.templateId || "",
        recipientType: editing.recipientType || "manual",
        recipientEmails: editing.recipientEmails || [],
        selectedGroups: editing.groupIds || [],
        importBatchId: editing.importBatchId || null,
        scheduledAt: editing.scheduledAt ? new Date(editing.scheduledAt).toISOString().slice(0, 16) : ""
      });
    }
  }, [editing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let campaignData = {
        name: form.name,
        subject: form.subject,
        fromEmail: form.fromEmail,
        fromName: form.fromName,
        replyTo: form.replyTo,
        templateId: form.templateId,
        recipientType: form.recipientType,
        scheduledAt: form.scheduledAt
      };

      // Add recipient data based on type
      switch (form.recipientType) {
        case 'manual':
          campaignData.recipientEmails = form.recipientEmails;
          break;
        case 'groups':
          campaignData.groupIds = form.selectedGroups;
          break;
        case 'import':
          campaignData.importBatchId = form.importBatchId;
          break;
      }

      const url = editing ? `/email-campaigns/${editing._id}` : '/email-campaigns';
      const method = editing ? 'put' : 'post';

      const response = await api[method](url, campaignData);

      if (response.data.success) {
        onSaved && onSaved(response.data.data);
        if (!editing) {
          setForm({
            name: "",
            subject: "",
            fromEmail: "",
            fromName: "",
            replyTo: "",
            templateId: "",
            recipientType: "manual",
            recipientEmails: [],
            selectedGroups: [],
            importBatchId: null,
            scheduledAt: ""
          });
          setImportData(null);
        }
      }

    } catch (error) {
      console.error("Campaign save error:", error);
      alert(error.response?.data?.message || error.message || "Failed to save campaign");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTemplate = Array.isArray(templates) ? templates.find(t => t._id === form.templateId) : null;

  // Initialize inline template content when template is selected
  useEffect(() => {
    if (selectedTemplate && !inlineEditMode) {
      setInlineTemplateContent(selectedTemplate.htmlBody || '');
    }
  }, [selectedTemplate]);

  // Handle inline template editing
  const handleInlineEdit = () => {
    setInlineEditMode(true);
    if (selectedTemplate) {
      setInlineTemplateContent(selectedTemplate.htmlBody || '');
    }
  };

  const handleInlineSave = async () => {
    if (!selectedTemplate) return;
    
    try {
      const response = await api.put(`/email-templates/${selectedTemplate._id}`, {
        htmlBody: inlineTemplateContent
      });
      
      if (response.data.success) {
        // Update local template data
        setTemplates(prev => prev.map(t => 
          t._id === selectedTemplate._id 
            ? { ...t, htmlBody: inlineTemplateContent }
            : t
        ));
        setInlineEditMode(false);
        alert('Template updated successfully!');
      } else {
        alert('Failed to update template');
      }
    } catch (error) {
      console.error('Template update error:', error);
      alert('Failed to update template');
    }
  };

  const handleInlineCancel = () => {
    setInlineEditMode(false);
    if (selectedTemplate) {
      setInlineTemplateContent(selectedTemplate.htmlBody || '');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {editing ? 'Edit Email Campaign' : 'Create New Campaign'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">Configure your email broadcast settings and preview your content.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel || (() => navigate('/campaigns/email'))}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all font-semibold text-sm shadow-[0px_4px_12px_rgba(0,0,0,0.05)] shadow-blue-200 flex items-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FiSend className="w-4 h-4" />
              )}
              {editing ? 'Update Campaign' : 'Launch Campaign'}
            </button>
          </div>
        </div>

        {/* Two Column Layout - Campaign Form (60%) + Live Preview (40%) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column - Campaign Form (60%) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Campaign Details Card */}
            <div className="bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-slate-200/60 p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Campaign Configuration
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500 transition-all bg-white hover:bg-gray-50"
                    placeholder="e.g., Monthly Newsletter"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500 transition-all bg-white hover:bg-gray-50"
                    placeholder="e.g., Your Monthly Updates"
                    required
                  />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">From Details</h3>
                  
                  <div className="space-y-4">
                    {/* From Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        From Email *
                      </label>
                      {loadingSmtp ? (
                        <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                          Loading SMTP configuration...
                        </div>
                      ) : smtpConfig ? (
                        <div>
                          <input
                            type="email"
                            value={form.fromEmail}
                            readOnly
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                            placeholder="e.g., john@company.com"
                            required
                          />
                          <div className="text-xs text-gray-500 mt-1">Auto-filled from Email Integration</div>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="email"
                            value={form.fromEmail}
                            onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                            placeholder="e.g., john@company.com"
                            required
                          />
                          <div className="text-xs text-amber-600 mt-1">
                            ⚠️ SMTP not configured. <a href="/integrations/email" className="text-blue-600 hover:underline">Configure Email Integration</a>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* From Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        From Name
                      </label>
                      <input
                        type="text"
                        value={form.fromName}
                        onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                        placeholder="e.g., John Doe"
                      />
                    </div>

                    {/* Reply To */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reply To
                      </label>
                      {loadingSmtp ? (
                        <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                          Loading SMTP configuration...
                        </div>
                      ) : smtpConfig ? (
                        <div>
                          <input
                            type="email"
                            value={form.replyTo || smtpConfig.fromEmail}
                            readOnly
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                            placeholder="e.g., replies@company.com"
                          />
                          <div className="text-xs text-gray-500 mt-1">Auto-filled from Email Integration</div>
                        </div>
                      ) : (
                        <input
                          type="email"
                          value={form.replyTo}
                          onChange={(e) => setForm({ ...form, replyTo: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                          placeholder="e.g., replies@company.com"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Template *
                  </label>
                  <div className="flex gap-2">
                    {/* Custom Template Dropdown */}
                    <div className="flex-1 relative template-dropdown">
                      <button
                        type="button"
                        onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-white text-left flex items-center justify-between"
                      >
                        <span className={selectedTemplate ? 'text-gray-900' : 'text-gray-500'}>
                          {selectedTemplate ? selectedTemplate.name : 'Select Template'}
                        </span>
                        <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {showTemplateDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                          <div className="max-h-48 overflow-y-auto p-2">
                            <div className="grid grid-cols-2 gap-2">
                              {Array.isArray(templates) && templates.map((template) => (
                                <button
                                  key={template._id}
                                  type="button"
                                  onClick={() => {
                                    setForm({ ...form, templateId: template._id });
                                    setShowTemplateDropdown(false);
                                  }}
                                  className={`p-3 text-left hover:bg-gray-50 rounded-lg border transition-all ${
                                    selectedTemplate?._id === template._id 
                                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                      : 'border-gray-200 text-gray-900'
                                  }`}
                                >
                                  <div className="text-sm font-medium truncate">{template.name}</div>
                                  {selectedTemplate?._id === template._id && (
                                    <FiCheck className="w-4 h-4 text-blue-600 mt-1" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {selectedTemplate && (
                      <>
                        <button
                          type="button"
                          onClick={handleInlineEdit}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                        >
                          <FiEdit2 className="w-4 h-4" />
                          Inline Edit
                        </button>

                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to send immediately, or schedule for later
                  </p>
                </div>
              </div>
            </div>

            {/* Recipients Card */}
            <div className="bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-slate-200/60 p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Audience Selection
              </h2>

              {/* Recipient Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Recipient Source
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, recipientType: 'manual' })}
                    className={`p-4 rounded-[12px] border-2 transition-all flex flex-col items-center gap-2 ${form.recipientType === 'manual'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-slate-50/50 text-slate-400 hover:border-slate-200 hover:text-slate-500'
                      }`}
                  >
                    <FiUser size={20} />
                    <div className="text-xs font-bold uppercase tracking-wider">Manual</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, recipientType: 'groups' })}
                    className={`p-4 rounded-[12px] border-2 transition-all flex flex-col items-center gap-2 ${form.recipientType === 'groups'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-slate-50/50 text-slate-400 hover:border-slate-200 hover:text-slate-500'
                      }`}
                  >
                    <FiUsers size={20} />
                    <div className="text-xs font-bold uppercase tracking-wider">Groups</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, recipientType: 'import' })}
                    className={`p-4 rounded-[12px] border-2 transition-all flex flex-col items-center gap-2 ${form.recipientType === 'import'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-slate-50/50 text-slate-400 hover:border-slate-200 hover:text-slate-500'
                      }`}
                  >
                    <FiUpload size={20} />
                    <div className="text-xs font-bold uppercase tracking-wider">Import</div>
                  </button>
                </div>
              </div>

              {/* Recipient Content Based on Type */}
              <div>
                {form.recipientType === 'manual' && (
                  <ManualRecipients
                    recipients={form.recipientEmails}
                    onChange={(emails) => setForm({ ...form, recipientEmails: emails })}
                    onAdd={(email) => setForm({ ...form, recipientEmails: [...form.recipientEmails, email] })}
                    onRemove={(index) => setForm({
                      ...form,
                      recipientEmails: form.recipientEmails.filter((_, i) => i !== index)
                    })}
                  />
                )}

                {form.recipientType === 'groups' && (
                  <GroupRecipients
                    selectedGroups={form.selectedGroups}
                    groups={groups}
                    onChange={(groupIds) => setForm({ ...form, selectedGroups: groupIds })}
                  />
                )}

                {form.recipientType === 'import' && (
                  <ImportRecipients
                    importData={importData}
                    onUpload={(data) => {
                      setImportData(data);
                      setForm({ ...form, importBatchId: data._id });
                    }}
                    onClear={() => {
                      setImportData(null);
                      setForm({ ...form, importBatchId: null });
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Live Preview (40%) */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-6 space-y-6">
              {/* Live Preview Card */}
              <div className="bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-blue-50">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                      Live Preview
                    </h2>
                    {selectedTemplate && (
                      <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                        {selectedTemplate.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <EmailPreview
                    template={selectedTemplate}
                    subject={form.subject}
                    fromName={form.fromName}
                    fromEmail={form.fromEmail}
                    inlineEditMode={inlineEditMode}
                    inlineTemplateContent={inlineTemplateContent}
                    onInlineContentChange={setInlineTemplateContent}
                    onInlineSave={handleInlineSave}
                    onInlineCancel={handleInlineCancel}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Info Footer */}
        <div className="mt-8 pt-8 border-t border-slate-200/60">
          <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-widest">
            <div className="w-1.5 h-1.5 bg-slate-300 rounded-full"></div>
            {editing ? 'Modifying existing campaign strategy' : 'New campaign orchestration engine ready'}
          </div>
        </div>
      </form>
    </div>
  );
}

export default EmailCampaignForm;