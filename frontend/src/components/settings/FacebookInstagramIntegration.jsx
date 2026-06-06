// components/settings/FacebookInstagramIntegration.jsx
// Premium Glassmorphism UI panel for connecting, configuring, and viewing real-time Facebook and Instagram webhook logs

import React, { useState, useEffect } from 'react';
import {
  FiInstagram, FiFacebook, FiGlobe, FiActivity, FiRefreshCw,
  FiLink, FiCopy, FiCheckCircle, FiInfo, FiExternalLink,
  FiSettings, FiShield, FiKey, FiZap, FiCheck, FiTrash2
} from 'react-icons/fi';
import api from '../../api/api';
import { useIntegration } from '../../context/IntegrationContext';

const FacebookInstagramIntegration = ({ successMessage, errorMessage, setSuccessMessage, setErrorMessage }) => {
  const { refreshStatus } = useIntegration();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [metaInfo, setMetaInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState('');

  const [formData, setFormData] = useState({
    facebookPageId: '',
    instagramBusinessId: '',
    appId: '',
    appSecret: '',
    accessToken: ''
  });

  const fetchConfigAndLogs = async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      // Fetch both configuration status and recent webhook logs
      const [configRes, logsRes] = await Promise.all([
        api.get('/integrations/meta/config'),
        api.get('/integrations/meta/logs').catch(() => ({ data: { success: false, data: [] } }))
      ]);

      if (configRes.data.success && configRes.data.data) {
        const configData = configRes.data.data;
        const isConnected = configData.status === 'connected' || configData.isActive === true;

        setMetaInfo({
          connected: isConnected,
          facebookPageId: configData.facebookPageId || '',
          facebookPageName: configData.facebookPageName || '',
          instagramBusinessId: configData.instagramBusinessId || '',
          instagramUsername: configData.instagramUsername || '',
          appId: configData.appId || '',
          maskedAppSecret: configData.maskedAppSecret || '',
          maskedAccessToken: configData.maskedAccessToken || '',
          verifyToken: configData.verifyToken || '',
          callbackUrl: configData.callbackUrl || '',
          webhookStatus: configData.webhookStatus || 'inactive',
          lastSync: configData.lastSync || new Date().toISOString(),
          userId: configData.userId || ''
        });

        // Initialize form fields for convenience
        setFormData({
          facebookPageId: configData.facebookPageId || '',
          instagramBusinessId: configData.instagramBusinessId || '',
          appId: configData.appId || '',
          appSecret: '',
          accessToken: ''
        });
      }

      if (logsRes.data.success && logsRes.data.data) {
        setLogs(logsRes.data.data);
      }
    } catch (err) {
      console.error('❌ Failed to retrieve Meta configurations:', err);
      setErrorMessage('Could not connect to service. Verify your backend server is online.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigAndLogs();
  }, []);

  // Set up real-time Socket.io listeners to stream webhook packets in real-time
  useEffect(() => {
    const handleNewMetaEvent = (newLog) => {
      console.log('🔌 [Socket.io] Inbound Meta webhook packet streamed:', newLog);
      setLogs((prev) => [newLog, ...prev].slice(0, 20));

      // Flash dynamic success toast on action triggers
      setSuccessMessage(`New webhook event logged: ${newLog.eventType.toUpperCase()}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    };

    if (window.zepofySocket) {
      window.zepofySocket.on('meta_event_logged', handleNewMetaEvent);
      console.log('🔌 [Socket.io] Successfully bound "meta_event_logged" event listener');
    }

    return () => {
      if (window.zepofySocket) {
        window.zepofySocket.off('meta_event_logged', handleNewMetaEvent);
      }
    };
  }, [setSuccessMessage]);

  const handleInputChange = (e) => {
    e.stopPropagation();
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    setConnecting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await api.post('/integrations/meta/connect', formData);
      if (res.data.success) {
        setSuccessMessage('Facebook & Instagram integrated successfully!');
        await refreshStatus();
        await fetchConfigAndLogs();
      } else {
        setErrorMessage(res.data.error || 'Connection handshake failed.');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Integration verification failed. Confirm token and page ID values.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Facebook & Instagram connection? This stops real-time webhook logging.')) {
      return;
    }
    setConnecting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await api.post('/integrations/meta/revoke');
      if (res.data.success) {
        setSuccessMessage('Meta integration connection revoked.');
        setFormData({ facebookPageId: '', instagramBusinessId: '', appId: '', appSecret: '', accessToken: '' });
        await refreshStatus();
        await fetchConfigAndLogs();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Failed to disconnect integration.');
    } finally {
      setConnecting(false);
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(''), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <FiRefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  const isConnected = metaInfo?.connected === true || metaInfo?.status === 'connected';
  const WEBHOOK_BASE = import.meta.env.BASE_API_URL || import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
  const webhookUrl = isConnected ? `${WEBHOOK_BASE}/api/webhook/meta/${metaInfo?.userId || 'USER_ID'}` : '';

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-16 font-poppins text-slate-800">
      {/* Header Card */}
      <div className="relative overflow-hidden bg-white rounded-[28px] p-8 border border-slate-200/60 shadow-sm group">
        <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-all duration-1000">
          <FiInstagram size={120} />
        </div>
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-4 mb-5">
              <div className="p-4 bg-gradient-to-r from-[#1877F2] via-[#833AB4] to-[#E1306C] text-white rounded-2xl shadow-xl shadow-purple-500/20">
                <div className="flex gap-1.5 items-center">
                  <FiFacebook size={24} strokeWidth={2} />
                  <span className="text-xl leading-none font-light">|</span>
                  <FiInstagram size={24} strokeWidth={2} />
                </div>
              </div>
              <div className="space-y-0.5">
                <h2 className="text-2xl font-semibold text-slate-900 tracking-tight font-poppins">Facebook & Instagram</h2>
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-0.5 bg-pink-50 text-pink-600 rounded-md text-[9px] font-bold uppercase tracking-widest border border-pink-100 font-poppins">Social Connect</div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest opacity-60 font-poppins">• Meta Suite Webhooks</span>
                </div>
              </div>
            </div>
            <p className="text-slate-500 leading-relaxed font-medium text-[14px]">
              Connect Facebook Pages and Instagram Business accounts to track messages, comment notifications, mentions, and Facebook Lead Ads events. Stream incoming webhook requests in real-time.
            </p>
          </div>
          <div>
            {isConnected ? (
              <div className="flex flex-col items-center xl:items-end gap-2 px-6 py-4 bg-emerald-50/40 rounded-2xl border border-emerald-100 shadow-sm">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-emerald-600 rounded-full text-[11px] font-bold border border-emerald-100 shadow-sm uppercase tracking-widest">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  Connected
                </div>
                <span className="text-[9px] text-emerald-600/70 font-semibold uppercase tracking-widest">Live Listener Active</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-slate-100 text-slate-400 rounded-full text-[11px] font-bold uppercase tracking-widest border border-slate-200">
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                Offline
              </div>
            )}
          </div>
        </div>
      </div>

      {isConnected ? (
        <div className="space-y-10">
          {/* Connection Overview */}
          <div className="bg-white rounded-[28px] shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center px-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                  <FiActivity className="text-pink-600" size={16} strokeWidth={2} />
                </div>
                <h3 className="font-semibold text-slate-800 text-[16px] tracking-tight">Active Social Handles</h3>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={connecting}
                className="text-[10px] font-bold uppercase tracking-widest text-red-600 bg-white border border-red-100 px-5 py-2.5 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
              >
                Revoke Integration
              </button>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Facebook Page</div>
                  <div className="font-bold text-slate-800 text-[15px] truncate flex items-center gap-2">
                    <FiFacebook className="text-blue-600 inline" /> {metaInfo.facebookPageName || 'Synced Page'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">ID: {metaInfo.facebookPageId}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Instagram Business</div>
                  <div className="font-bold text-slate-800 text-[15px] truncate flex items-center gap-2">
                    <FiInstagram className="text-pink-600 inline" /> @{metaInfo.instagramUsername || 'Synced User'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">ID: {metaInfo.instagramBusinessId}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Meta App ID</div>
                  <div className="font-mono text-slate-700 font-medium text-sm bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 truncate">{metaInfo.appId}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Webhook Sync</div>
                  <div className="font-semibold text-slate-800 text-[13px] bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 inline-block uppercase tracking-wider">
                    {metaInfo.webhookStatus === 'active' ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Last Checked</div>
                  <div className="font-medium text-slate-500 text-[13px]">
                    {metaInfo.lastSync ? new Date(metaInfo.lastSync).toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Webhook Configuration */}
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                  <FiZap className="text-amber-500" size={18} strokeWidth={2} />
                </div>
                <h3 className="font-semibold text-slate-800 text-lg tracking-tight">Webhook Configurations</h3>
              </div>
              <div className="px-5 py-2 rounded-full text-[10px] font-semibold border border-emerald-200 bg-emerald-50 text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                Endpoint Subscribed
              </div>
            </div>
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Callback URL</label>
                  <div className="flex gap-3">
                      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-[20px] px-6 py-4.5 font-mono text-sm text-slate-600 truncate border-dashed select-all">
                        {webhookUrl || 'Waiting for configuration...'}
                      </div>
                      <button onClick={() => copyToClipboard(webhookUrl, 'webhook')} className="px-6 py-4 bg-slate-900 text-white rounded-[20px] font-semibold hover:bg-black transition-all shadow-lg flex-shrink-0 active:scale-95">
                      {copied === 'webhook' ? <FiCheck className="text-emerald-400" /> : <FiCopy />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium ml-1 italic opacity-60 flex items-center gap-1.5">
                    <FiInfo size={12} /> Enter inside Facebook Developers Dashboard &rarr; Messenger/Instagram &rarr; Webhook Setup
                  </p>
                </div>
                <div className="space-y-3">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Verify Token</label>
                  <div className="flex gap-3">
                    <div className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-[20px] px-6 py-4 font-mono text-sm text-slate-600 truncate border-dashed select-all">
                      {metaInfo.verifyToken}
                    </div>
                    <button onClick={() => copyToClipboard(metaInfo.verifyToken, 'token')} className="px-6 py-4 bg-white text-slate-900 border border-slate-200 rounded-[20px] font-semibold hover:bg-slate-50 transition-all shadow-sm flex-shrink-0 active:scale-95">
                      {copied === 'token' ? <FiCheck className="text-emerald-500" /> : <FiCopy />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium ml-1 italic opacity-60 flex items-center gap-1.5">
                    <FiInfo size={12} /> Paste into Meta "Verify Token" field to confirm challenge handshakes securely.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Webhook Logs streaming card */}
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                  <FiGlobe className="text-blue-500" size={18} strokeWidth={2} />
                </div>
                <h3 className="font-semibold text-slate-800 text-lg tracking-tight">Real-Time Webhook Event Stream</h3>
              </div>
              <button
                onClick={fetchConfigAndLogs}
                className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                title="Refresh Logs"
              >
                <FiRefreshCw size={16} />
              </button>
            </div>

            <div className="p-8">
              {logs.length === 0 ? (
                <div className="text-center py-16 text-slate-400 space-y-4">
                  <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-300">
                    <FiActivity size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-slate-700 text-sm">Awaiting first webhook packet...</h5>
                    <p className="text-[12px] text-slate-400 mt-1 max-w-md mx-auto">
                      Send a message or post a comment on your linked pages. Meta will automatically trigger webhooks and render details here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse font-poppins relative">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="pb-4 pl-4">Platform</th>
                        <th className="pb-4">Event Type</th>
                        <th className="pb-4">Sender ID</th>
                        <th className="pb-4">Logged Time</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4 text-right pr-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((log) => (
                        <tr key={log._id || log.timestamp || Math.random()} className="text-[13px] font-medium text-slate-600 hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 pl-4">
                            <span className="flex items-center gap-2">
                              {log.platform === 'instagram' ? (
                                <FiInstagram className="text-pink-500 w-4 h-4" />
                              ) : (
                                <FiFacebook className="text-blue-600 w-4 h-4" />
                              )}
                              <span className="capitalize text-slate-900 font-semibold text-[12px]">{log.platform}</span>
                            </span>
                          </td>
                          <td className="py-4">
                            <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold tracking-wide uppercase border border-slate-200/50 font-mono">
                              {log.eventType}
                            </span>
                          </td>
                          <td className="py-4 font-mono text-[12px]">{log.senderId || 'System'}</td>
                          <td className="py-4 text-[12px] text-slate-400">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-4">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                              <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                              Logged
                            </span>
                          </td>
                          <td className="py-4 text-right pr-4">
                            <button
                              onClick={() => {
                                alert(JSON.stringify(log.payload, null, 2));
                              }}
                              className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                            >
                              Raw JSON
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Disconnected Connection view */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-12 2xl:col-span-7 bg-white rounded-[32px] shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50/30">
              <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-3 tracking-tight">
                <FiSettings className="text-purple-600" /> Meta Integration Form
              </h3>
            </div>
            <form onSubmit={handleConnect} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Facebook Page ID*</label>
                  <input
                    type="text"
                    name="facebookPageId"
                    value={formData.facebookPageId}
                    onChange={handleInputChange}
                    placeholder="Ex: 10672834923"
                    className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] focus:bg-white focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 outline-none transition-all font-mono text-sm font-medium"
                    required
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Instagram Business ID*</label>
                  <input
                    type="text"
                    name="instagramBusinessId"
                    value={formData.instagramBusinessId}
                    onChange={handleInputChange}
                    placeholder="Ex: 178414002345"
                    className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] focus:bg-white focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 outline-none transition-all font-mono text-sm font-medium"
                    required
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Meta App ID*</label>
                  <input
                    type="text"
                    name="appId"
                    value={formData.appId}
                    onChange={handleInputChange}
                    placeholder="Meta developer dashboard App ID"
                    className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] focus:bg-white focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 outline-none transition-all font-mono text-sm font-medium"
                    required
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Meta App Secret*</label>
                  <input
                    type="password"
                    name="appSecret"
                    value={formData.appSecret}
                    onChange={handleInputChange}
                    placeholder="Enter App Secret"
                    className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] focus:bg-white focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 outline-none transition-all font-mono text-sm font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Permanent Access Token*</label>
                <input
                  type="password"
                  name="accessToken"
                  value={formData.accessToken}
                  onChange={handleInputChange}
                  placeholder="Enter permanent Page Access Token starting with EAAD..."
                  className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] focus:bg-white focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 outline-none transition-all font-mono text-sm font-medium"
                  required
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={connecting}
                  className="w-full flex items-center justify-center gap-4 px-10 py-5 bg-gradient-to-r from-[#1877F2] via-[#833AB4] to-[#E1306C] text-white rounded-[24px] font-semibold text-lg hover:opacity-90 transition-all shadow-xl shadow-purple-500/20 disabled:opacity-50 group hover:-translate-y-1"
                >
                  {connecting ? <FiRefreshCw className="animate-spin" /> : <FiZap className="group-hover:text-yellow-400 group-hover:scale-110 transition-all" />}
                  {connecting ? "Validating integration handles..." : "Establish Meta Connection"}
                </button>
              </div>
            </form>
          </div>

          {/* Setup Guide */}
          <div className="lg:col-span-12 2xl:col-span-5 space-y-8">
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-200/60 p-8">
              <h3 className="font-semibold text-slate-800 mb-8 flex items-center gap-3 tracking-tight">
                <FiInfo className="text-purple-500" /> Developer Setup Guide
              </h3>
              <div className="space-y-6">
                {[
                  {
                    title: '1. Create Meta Business App',
                    desc: 'Create a Business App on developers.facebook.com. Link it to your Meta Business Manager and associate the Facebook Page & Instagram account.'
                  },
                  {
                    title: '2. Enable Facebook Page Link',
                    desc: 'In Facebook Page settings, connect your page to your Instagram Business account to pair the APIs.'
                  },
                  {
                    title: '3. Scope Required Permissions',
                    desc: 'Generate a Page token on developers.facebook.com with these scopes: pages_show_list, pages_read_engagement, pages_manage_metadata, instagram_basic, instagram_manage_messages.'
                  },
                  {
                    title: '4. Get Credentials IDs',
                    desc: 'Fetch Page ID, Instagram ID from Page & IG Settings. Copy App ID and App Secret from Basic Settings of developers portal.'
                  },
                  {
                    title: '5. Subscribe to Webhooks',
                    desc: 'Set the generated Verify Token and Callback URL here into the webhooks section inside your Meta App Developer panel.'
                  }
                ].map((item, i) => (
                  <div key={i} className="flex gap-5 p-5 bg-purple-50/30 rounded-[24px] border border-purple-100/50 transition-all hover:bg-white hover:shadow-md group">
                    <div className="flex-shrink-0 w-10 h-10 bg-white text-purple-600 rounded-xl flex items-center justify-center font-semibold text-sm shadow-sm group-hover:bg-gradient-to-br group-hover:from-blue-600 group-hover:to-purple-600 group-hover:text-white transition-all">
                      {i + 1}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-[13px] mb-1 uppercase tracking-tight">{item.title}</h4>
                      <p className="text-[12px] text-slate-500 leading-relaxed font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-300">
              <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                <FiShield size={80} />
              </div>
              <h4 className="font-semibold text-xl mb-3 tracking-tight relative z-10">Meta Webhook Layer</h4>
              <p className="text-[13px] text-slate-400 leading-relaxed relative z-10 font-medium italic opacity-70">
                Data is fully encrypted using SHA-256 HMAC digital signatures. Tokens are stored in AES-256-CBC format at rest, strictly mapping multi-tenant boundaries.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacebookInstagramIntegration;
