import React, { useState, useEffect } from 'react';
import { 
  FiCpu, FiKey, FiSave, FiZap, FiActivity, FiMessageSquare, 
  FiInfo, FiDatabase, FiCheckCircle, FiXCircle, FiLoader, FiSend,
  FiEye, FiEyeOff
} from 'react-icons/fi';
import api from '../../api/api';

export default function AIIntegration({ setSuccessMessage, setErrorMessage }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState({
    provider: 'gemini',
    apiKey: '',
    enabled: false,
    model: 'gemini-1.5-flash',
    prompt: '',
    knowledgeBase: '',
    features: {
      orderExtraction: false,
      campaignWriter: false,
      smartReplies: false
    }
  });
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/ai-integration/settings');
      if (res.data.success) {
        setSettings({
          ...res.data.settings,
          apiKey: res.data.settings.apiKey || ''
        });
        setHasKey(res.data.settings.hasKey);
      }
    } catch (error) {
      console.error('Failed to fetch AI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...settings };
      if (payload.apiKey === '********') delete payload.apiKey;

      const res = await api.post('/ai-integration/settings', payload);
      if (res.data.success) {
        setSuccessMessage('AI Configuration saved successfully');
        if (settings.apiKey && settings.apiKey !== '********') setHasKey(true);
        
        // Auto-clear message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to save settings';
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect Gemini? This will disable all AI features and clear your API Key.")) return;
    
    setSaving(true);
    try {
      const res = await api.post('/ai-integration/settings', { 
        ...settings, 
        apiKey: "", 
        enabled: false,
        status: "not_configured"
      });
      if (res.data.success) {
        setSettings({
          ...settings,
          apiKey: '',
          enabled: false,
          status: 'not_configured'
        });
        setHasKey(false);
        setSuccessMessage('AI Integration disconnected and key cleared.');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      setErrorMessage('Failed to disconnect AI integration');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post('/ai-integration/test', {
        apiKey: settings.apiKey,
        provider: settings.provider,
        model: settings.model // 🔥 Pass the selected model
      });
      if (res.data.success) {
        setSuccessMessage('Gemini API Connection successful!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(res.data.error || 'Failed to connect to Gemini. Please check your API key.');
        setTimeout(() => setErrorMessage(''), 3000);
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Connection error. Please try again.');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <FiLoader className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Initializing AI Protocol...</p>
      </div>
    );
  }

  return (
    <div className="w-full px-4 xl:px-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">AI Integration Hub</h1>
          <p className="text-[13px] text-slate-500 font-medium">Manage your Google Gemini AI configuration and smart features</p>
        </div>
        <button 
          onClick={handleDisconnect}
          disabled={!hasKey || saving}
          className="px-8 py-3 bg-white text-rose-600 rounded-2xl text-[12px] font-black uppercase tracking-widest border-2 border-rose-50 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? 'Processing...' : 'Disconnect AI'}
        </button>
      </div>
      {/* Header Card */}
      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50/50 to-purple-50/50 rounded-full -translate-y-32 translate-x-32 blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
        
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[24px] flex items-center justify-center text-white shadow-xl shadow-blue-200 shrink-0">
            <FiCpu size={36} className="animate-pulse" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">AI Protocol Configuration</h2>
              {hasKey ? (
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${settings.enabled ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                  {settings.enabled ? 'Active Protocol' : 'Paused'}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-slate-50 text-slate-400 border-slate-100">
                  Not Configured
                </span>
              )}
            </div>
            <p className="text-slate-500 text-[14px] font-medium leading-relaxed max-w-xl">
              Empower your business with Google Gemini AI. Automatically handle customer inquiries and extract order details when your automation flows don't have a direct answer.
            </p>
          </div>
          <div className="shrink-0 pt-2">
            <button
              onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-500 outline-none focus:ring-4 focus:ring-blue-100 ${settings.enabled ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-500 ${settings.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Config */}
        <div className="lg:col-span-6 space-y-8">
          {/* API Credentials */}
          <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-slate-900 pb-2 border-b border-slate-50">
              <FiKey className="text-blue-600" size={20} />
              <h2 className="font-bold text-[16px] tracking-tight">API Credentials</h2>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-slate-400 uppercase tracking-wider px-1">Gemini API Key</label>
                <div className="relative group">
                  <input
                    type={showKey ? "text" : "password"}
                    placeholder={hasKey ? "Connected (********)" : "Enter your Gemini API Key"}
                    value={settings.apiKey}
                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                    className={`w-full pl-12 pr-12 py-4 bg-slate-50 border rounded-2xl outline-none focus:ring-4 transition-all text-sm font-semibold ${hasKey ? 'border-emerald-100 focus:ring-emerald-50' : 'border-slate-200 focus:ring-blue-100 focus:border-blue-500'}`}
                  />
                  <FiKey className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${hasKey ? 'text-emerald-500' : 'text-slate-300'}`} size={18} />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {showKey ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
                {hasKey && (
                  <p className="text-[10px] text-emerald-600 font-bold px-1 flex items-center gap-1">
                    <FiCheckCircle size={12} />
                    API Key is securely connected
                  </p>
                )}
                <p className="text-[11px] text-slate-400 font-medium px-1">
                  Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[12px] font-bold text-slate-400 uppercase tracking-wider px-1">Provider</label>
                  <select 
                    value={settings.provider}
                    onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700 appearance-none"
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai" disabled>OpenAI (Coming Soon)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] font-bold text-slate-400 uppercase tracking-wider px-1">Model</label>
                  <select 
                    value={settings.model}
                    onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700 appearance-none"
                  >
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash (Next-Gen)</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (Powerful)</option>
                    <option value="gemini-pro">Gemini Pro 1.0 (Stable)</option>
                    <option value="gemini-2.0-flash-lite-preview-02-05">Gemini 2.0 Flash Lite</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Experimental)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (Experimental)</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={handleTest}
              disabled={testing || (!settings.apiKey && !hasKey)}
              className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl text-[13px] font-bold border border-slate-200 hover:bg-white hover:border-blue-600 hover:text-blue-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {testing ? <FiLoader className="animate-spin" /> : <FiActivity className="group-hover:scale-110 transition-transform" />}
              {testing ? 'Verifying...' : 'Test Connection'}
            </button>
          </div>

          {/* AI Persona */}
          <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-slate-900 pb-2 border-b border-slate-50">
              <FiMessageSquare className="text-purple-600" size={20} />
              <h2 className="font-bold text-[16px] tracking-tight">AI Persona & System Prompt</h2>
            </div>
            <div className="space-y-2">
              <p className="text-[12px] text-slate-500 font-medium pb-2 italic">
                Define how the AI should behave. e.g. "You are a customer support agent for Zepofy. Be professional and helpful."
              </p>
              <textarea
                value={settings.prompt}
                onChange={(e) => setSettings({ ...settings, prompt: e.target.value })}
                rows={4}
                className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all text-sm font-medium leading-relaxed resize-none"
                placeholder="Enter system instructions..."
              />
            </div>
              {/* 🧠 Smart Features Section */}
              <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 mt-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                    <FiZap size={20} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-slate-900">Smart Features</h3>
                    <p className="text-[11px] text-slate-500">Enable advanced AI capabilities across the platform</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <FiDatabase size={18} />
                      </div>
                      <div>
                        <h4 className="text-[13px] text-slate-900 font-bold">AI Order Extraction</h4>
                        <p className="text-[10px] text-slate-400">Automatically extract name/address from customer messages</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.features?.orderExtraction}
                        onChange={(e) => setSettings({
                          ...settings, 
                          features: { ...settings.features, orderExtraction: e.target.checked }
                        })}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                        <FiSend size={18} />
                      </div>
                      <div>
                        <h4 className="text-[13px] text-slate-900 font-bold">AI Campaign Copywriter</h4>
                        <p className="text-[10px] text-slate-400">Generate high-converting marketing messages for campaigns</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.features?.campaignWriter}
                        onChange={(e) => setSettings({
                          ...settings, 
                          features: { ...settings.features, campaignWriter: e.target.checked }
                        })}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                        <FiMessageSquare size={18} />
                      </div>
                      <div>
                        <h4 className="text-[13px] text-slate-900 font-bold">Smart Reply Suggestions</h4>
                        <p className="text-[10px] text-slate-400">Get AI-powered reply suggestions in the live chat</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.features?.smartReplies}
                        onChange={(e) => setSettings({
                          ...settings, 
                          features: { ...settings.features, smartReplies: e.target.checked }
                        })}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              </div>
          </div>
        </div>

        {/* Right Column: Knowledge */}
        <div className="lg:col-span-6 space-y-8">
          <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-6 h-full flex flex-col">
            <div className="flex items-center gap-3 text-slate-900 pb-2 border-b border-slate-50">
              <FiDatabase className="text-emerald-600" size={20} />
              <h2 className="font-bold text-[16px] tracking-tight">Knowledge Base</h2>
            </div>
            <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
              Add specific details about your business (services, pricing, address) that the AI should know when answering customers.
            </p>
            <textarea
              value={settings.knowledgeBase}
              onChange={(e) => setSettings({ ...settings, knowledgeBase: e.target.value })}
              className="flex-1 w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all text-sm font-medium leading-relaxed resize-none min-h-[300px]"
              placeholder="Paste your business details, FAQs, or service lists here..."
            />
            <div className="bg-emerald-50 rounded-2xl p-4 flex items-start gap-3">
              <FiInfo className="text-emerald-600 mt-1 shrink-0" size={16} />
              <p className="text-[11px] text-emerald-700 leading-tight font-medium">
                Tip: Use clear, bulleted lists for better AI retrieval.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-4 pt-4">
        <div className="bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-3 animate-in slide-in-from-right-10 duration-1000">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Systems Ready</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-10 py-4 bg-blue-600 text-white rounded-[20px] text-[14px] font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-3"
        >
          {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
          {saving ? 'Synchronizing...' : 'Deploy AI Configuration'}
        </button>
      </div>
    </div>
  );
}
