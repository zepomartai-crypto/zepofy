import React, { useState, useEffect } from 'react';
import { FiMessageSquare, FiWifiOff, FiRefreshCw, FiLink, FiCopy, FiCheckCircle, FiInfo, FiExternalLink, FiSettings, FiShield, FiKey, FiZap, FiGlobe, FiCheck, FiActivity } from 'react-icons/fi';
import api from '../../api/api';
import { useIntegration } from '../../context/IntegrationContext';

const WhatsAppIntegration = ({ successMessage, errorMessage, setSuccessMessage, setErrorMessage }) => {
    const { refreshStatus } = useIntegration();
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [whatsappInfo, setWhatsappInfo] = useState(null);
    const [copied, setCopied] = useState('');

    const [formData, setFormData] = useState({
        phoneNumberId: '',
        accessToken: '',
        wabaId: '',
        businessPhoneNumber: '',
        appId: ''
    });

    const fetchStatus = async () => {
        try {
            setLoading(true);
            const res = await api.get('/integrations/whatsapp');
            if (res.data.success && res.data.data) {
                const data = res.data.data;
                const connectionStatus = data.connected === true || data.status === 'connected';

                setWhatsappInfo({
                    connected: connectionStatus,
                    status: data.status || 'not_connected',
                    phoneNumberId: data.phoneNumberId || '',
                    wabaId: data.wabaId || '',
                    businessPhoneNumber: data.businessPhoneNumber || data.businessNumber || '',
                    appId: data.appId || '',
                    userId: data.userId || data._id || '',
                    webhookUrl: data.webhookUrl || '',
                    webhookVerifyToken: data.webhookVerifyToken || '',
                    lastSync: data.lastSync || data.updatedAt || new Date().toISOString(),
                    accessToken: data.accessToken ? '******' : ''
                });
            } else {
                setWhatsappInfo({
                    connected: false, status: 'not_connected', phoneNumberId: '', wabaId: '', businessPhoneNumber: '', appId: '', userId: '', webhookUrl: '', webhookVerifyToken: '', lastSync: null, accessToken: ''
                });
            }
        } catch (err) {
            setWhatsappInfo({
                connected: false, status: 'not_connected', phoneNumberId: '', wabaId: '', businessPhoneNumber: '', appId: '', userId: '', webhookUrl: '', webhookVerifyToken: '', lastSync: null, accessToken: ''
            });
            if (err.response?.status !== 404) setErrorMessage('Failed to load WhatsApp status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleInputChange = (e) => {
        e.stopPropagation();
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleConnect = async (e) => {
        e.preventDefault();
        setConnecting(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const res = await api.post('/integrations/whatsapp/connect', formData);
            if (res.data.success) {
                setSuccessMessage('WhatsApp connected successfully!');
                await refreshStatus();
                fetchStatus();
            } else {
                setErrorMessage(res.data.error || 'Failed to connect WhatsApp');
            }
        } catch (err) {
            setErrorMessage(err.response?.data?.error || 'Failed to connect WhatsApp');
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm('Are you sure you want to disconnect WhatsApp?')) return;
        setConnecting(true);
        try {
            const res = await api.post('/integrations/whatsapp/disconnect');
            if (res.data.success) {
                setSuccessMessage('WhatsApp disconnected successfully');
                setFormData({ phoneNumberId: '', accessToken: '', wabaId: '', businessPhoneNumber: '', appId: '' });
                await refreshStatus();
                await fetchStatus();
            }
        } catch (err) {
            setErrorMessage(err.response?.data?.error || 'Failed to disconnect WhatsApp');
        } finally {
            setConnecting(false);
        }
    };

    const copyToClipboard = async (text, type) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(type);
            setTimeout(() => setCopied(''), 2000);
        } catch (err) { console.error('Failed to copy:', err); }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-24">
                <FiRefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
        );
    }

    const isConnected = whatsappInfo?.connected === true || whatsappInfo?.status === 'connected';
    const WEBHOOK_BASE = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
    const webhookUrl = `${WEBHOOK_BASE}/api/webhook/whatsapp/${whatsappInfo?.userId || 'USER_ID'}`;

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-16 font-poppins">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-white rounded-[28px] p-8 border border-slate-200/60 shadow-sm group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-all duration-1000">
                    <FiMessageSquare size={120} />
                </div>
                <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-md">
                                <FiMessageSquare size={28} strokeWidth={2} />
                            </div>
                            <div className="space-y-0.5">
                                <h2 className="text-2xl font-semibold text-slate-900 tracking-tight font-outfit">WhatsApp Business</h2>
                                <div className="flex items-center gap-2">
                                    <div className="px-2.5 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[9px] font-bold uppercase tracking-widest border border-blue-100 font-poppins">Official API</div>
                                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest opacity-60 font-poppins">• Meta Cloud Integration</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-slate-500 leading-relaxed font-medium text-[14px] font-inter">
                            Connect your Meta WhatsApp Business API to enable large-scale communication. Automate notifications, recover carts, and manage chats in real-time
                        </p>
                    </div>
                    <div>
                        {isConnected ? (
                            <div className="flex flex-col items-center xl:items-end gap-2 px-6 py-4 bg-emerald-50/40 rounded-2xl border border-emerald-100 shadow-sm">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-emerald-600 rounded-full text-[11px] font-bold border border-emerald-100 shadow-sm uppercase tracking-widest font-poppins">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    Connected
                                </div>
                                <span className="text-[9px] text-emerald-600/70 font-semibold uppercase tracking-widest font-poppins">System Synchronized</span>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-slate-100 text-slate-400 rounded-full text-[11px] font-bold uppercase tracking-widest border border-slate-200 font-poppins">
                                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                Service Offline
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {isConnected ? (
                    <div className="space-y-10">
                        {/* Connection Overview */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center px-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
                                        <FiActivity className="text-indigo-600" size={16} strokeWidth={2} />
                                    </div>
                                    <h3 className="font-semibold text-slate-800 text-[16px] tracking-tight font-outfit">Connection Overview</h3>
                                </div>
                                <button
                                    onClick={handleDisconnect}
                                    disabled={connecting}
                                    className="text-[10px] font-bold uppercase tracking-widest text-red-600 bg-white border border-red-100 px-5 py-2.5 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm font-poppins"
                                >
                                    Revoke Access
                                </button>
                            </div>
                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Phone Number ID</div>
                                        <div className="font-mono text-slate-900 font-medium text-sm bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 truncate">{whatsappInfo.phoneNumberId || 'N/A'}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">WABA ID</div>
                                        <div className="font-mono text-slate-900 font-medium text-sm bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 truncate">{whatsappInfo.wabaId || 'N/A'}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Business Number</div>
                                        <div className="font-medium text-slate-900 text-[15px] px-1">{whatsappInfo.businessPhoneNumber || 'N/A'}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Last Sync</div>
                                        <div className="font-medium text-slate-900 text-[15px] px-1">
                                            {whatsappInfo.lastSync ? new Date(whatsappInfo.lastSync).toLocaleDateString() : 'Initial Sync'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Webhook Configuration */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
                                        <FiZap className="text-amber-500" size={18} strokeWidth={2} />
                                    </div>
                                    <h3 className="font-semibold text-slate-800 text-lg tracking-tight font-outfit">Webhook Configuration</h3>
                                </div>
                                <div className={`px-5 py-2 rounded-full text-[10px] font-semibold border uppercase tracking-[0.2em] flex items-center gap-2.5 ${whatsappInfo.status === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                    <div className={`w-2 h-2 rounded-full ${whatsappInfo.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                    {whatsappInfo.status === 'connected' ? 'Endpoint Active' : 'Awaiting handshake'}
                                </div>
                            </div>
                            <div className="p-8 space-y-8">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Callback URL</label>
                                        <div className="flex gap-3">
                                            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-[20px] px-6 py-4.5 font-mono text-sm text-slate-600 truncate border-dashed select-all">
                                                {webhookUrl}
                                            </div>
                                            <button onClick={() => copyToClipboard(webhookUrl, 'webhook')} className="px-6 py-4 bg-slate-900 text-white rounded-[20px] font-semibold hover:bg-black transition-all shadow-lg flex-shrink-0 active:scale-95">
                                                {copied === 'webhook' ? <FiCheck /> : <FiCopy />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium ml-1 italic opacity-60 flex items-center gap-1.5">
                                            <FiInfo size={12} /> Paste in Meta Dashboard &rarr; Webhooks &rarr; Callback URL
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Verify Token</label>
                                        <div className="flex gap-3">
                                            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-[20px] px-6 py-4.5 font-mono text-sm text-slate-600 truncate border-dashed select-all">
                                                {whatsappInfo.webhookVerifyToken || 'Handshake pending...'}
                                            </div>
                                            <button onClick={() => copyToClipboard(whatsappInfo.webhookVerifyToken, 'token')} className="px-6 py-4 bg-white text-slate-900 border border-slate-200 rounded-[20px] font-semibold hover:bg-slate-50 transition-all shadow-sm flex-shrink-0 active:scale-95">
                                                {copied === 'token' ? <FiCheck /> : <FiCopy />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium ml-1 italic opacity-60 flex items-center gap-1.5">
                                            <FiInfo size={12} /> Paste in Meta Dashboard &rarr; Webhooks &rarr; Verify Token
                                        </p>
                                    </div>
                                </div>

                                <div className="p-8 bg-slate-900 rounded-[32px] text-white relative overflow-hidden shadow-2xl shadow-slate-300">
                                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                                        <FiActivity size={80} />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-semibold uppercase tracking-widest">
                                                <div className={`w-2 h-2 rounded-full ${whatsappInfo.status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`}></div>
                                                Live Diagnostics
                                            </div>
                                        </div>
                                        <h4 className="font-semibold text-xl mb-3 tracking-tight">System Operational Status</h4>
                                        <p className="text-[13px] text-slate-300 leading-relaxed max-w-2xl font-medium">
                                            {whatsappInfo.status === 'connected'
                                                ? "Direct tunnel established with Meta Cloud API. Webhook heartbeat detected. All inbound messages and status callbacks are processing through v20.0 security layer."
                                                : "Awaiting first synchronization packet. Please ensure your Meta App configuration is finalized to activate the live processing engine."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Disconnected View */
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-12 2xl:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-3 tracking-tight font-outfit">
                                    <FiSettings className="text-indigo-600" /> API Configuration
                                </h3>
                            </div>
                            <form onSubmit={handleConnect} className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Phone Number ID*</label>
                                        <input
                                            type="text"
                                            name="phoneNumberId"
                                            value={formData.phoneNumberId}
                                            onChange={handleInputChange}
                                            placeholder="Ex: 10234256789"
                                            className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all font-mono text-sm font-medium"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Business Number*</label>
                                        <input
                                            type="text"
                                            name="businessPhoneNumber"
                                            value={formData.businessPhoneNumber}
                                            onChange={handleInputChange}
                                            placeholder="Ex: +1 234 567 8900"
                                            className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all font-medium"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">WABA ID*</label>
                                        <input
                                            type="text"
                                            name="wabaId"
                                            value={formData.wabaId}
                                            onChange={handleInputChange}
                                            className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-mono text-sm font-medium"
                                            placeholder="WhatsApp Business Account ID"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">App ID</label>
                                        <input
                                            type="text"
                                            name="appId"
                                            value={formData.appId}
                                            onChange={handleInputChange}
                                            className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-mono text-sm font-medium"
                                            placeholder="Ex: 123456789012345"
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
                                        placeholder="Enter EAAD... System User Token"
                                        className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-mono text-sm font-medium"
                                        required
                                    />
                                </div>
                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={connecting}
                                        className="w-full flex items-center justify-center gap-4 px-10 py-5 bg-slate-900 text-white rounded-2xl font-semibold text-lg hover:bg-indigo-600 transition-all shadow-md disabled:opacity-50 group hover:-translate-y-1 font-inter"
                                    >
                                        {connecting ? <FiRefreshCw className="animate-spin" /> : <FiZap className="group-hover:text-yellow-400 group-hover:scale-110 transition-all" />}
                                        {connecting ? "Initializing Bridge..." : "Establish Official Connection"}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Setup Guide */}
                        <div className="lg:col-span-12 2xl:col-span-5 space-y-8">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                                <h3 className="font-semibold text-slate-800 mb-8 flex items-center gap-3 tracking-tight font-outfit text-lg">
                                    <FiInfo className="text-indigo-500" /> How to get Meta Keys?
                                </h3>
                                <div className="space-y-6">
                                    {[
                                        {
                                            title: '1. Create Meta App',
                                            desc: 'Go to developers.facebook.com, create a Business App and add the \"WhatsApp\" product to it.'
                                        },
                                        {
                                            title: '2. Get IDs & Number',
                                            desc: 'In WhatsApp > API Setup, you will find your Phone Number ID and WABA ID. Add your phone number there to get the Business Number.'
                                        },
                                        {
                                            title: '3. Find App ID',
                                            desc: 'Navigate to App Settings > Basic in your Meta Dashboard top bar to find your unique App ID.'
                                        },
                                        {
                                            title: '4. Generate Permanent Token',
                                            desc: 'Go to Business Settings > Users > System Users. Create a user, add your App as an asset, and click \"Generate Token\".'
                                        },
                                        {
                                            title: '5. Select Scopes',
                                            desc: 'Ensure token has \"whatsapp_business_messaging\" and \"whatsapp_business_management\" permissions enabled.'
                                        }
                                    ].map((item, i) => (
                                        <div key={i} className="flex gap-5 p-5 bg-blue-50/50 rounded-[24px] border border-blue-100 transition-all hover:bg-white hover:shadow-md group">
                                            <div className="flex-shrink-0 w-10 h-10 bg-white text-blue-600 rounded-xl flex items-center justify-center font-semibold text-sm shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
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
                                <h4 className="font-semibold text-xl mb-3 tracking-tight relative z-10">Meta Compliance</h4>
                                <p className="text-[13px] text-slate-400 leading-relaxed relative z-10 font-medium italic opacity-70">
                                    Zepofy operates exclusively via official Meta Cloud API v20.0+. Data is encrypted via SHA-256 and credentials are held at rest with military-grade AES-256 encryption.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppIntegration;
