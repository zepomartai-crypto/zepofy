import React, { useState, useEffect } from 'react';
import { FiServer, FiRefreshCw, FiLink, FiCheckCircle, FiAlertCircle, FiWifiOff, FiExternalLink, FiActivity, FiShoppingCart, FiSettings, FiKey, FiGlobe, FiZap, FiShoppingBag, FiInfo, FiCopy, FiCheck, FiShield } from 'react-icons/fi';
import api from '../../api/api';
import { useIntegration } from '../../context/IntegrationContext';
import { useAuth } from '../../context/useAuth';

const WooCommerceIntegration = ({ successMessage, errorMessage, setSuccessMessage, setErrorMessage }) => {
    const { refreshStatus } = useIntegration();
    const auth = useAuth();
    const user = auth?.user || null;
    const [userFromApi, setUserFromApi] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!user && token) {
            api.get('/auth/me').then(res => {
                if (res.data?.user) setUserFromApi(res.data.user);
            }).catch(err => console.debug('Auth fetch error:', err));
        }
    }, [user]);

    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [integration, setIntegration] = useState(null);
    const [templates, setTemplates] = useState([]);

    const userIdForWebhook = user?._id || userFromApi?._id || integration?.userId || '';

    const [formData, setFormData] = useState({ storeUrl: '', consumerKey: '', consumerSecret: '' });

    const [settings, setSettings] = useState({
        abandonedCartDelay: 60,
        enableAbandonedCart: false,
        abandonedCartTemplate: '',
        enableOrderConfirmation: false,
        orderConfirmationTemplate: ''
    });

    const fetchStatus = async () => {
        try {
            setLoading(true);
            const res = await api.get('/woocommerce/integration');
            if (res.data.success && res.data.data) {
                const data = res.data.data;
                setIntegration({
                    connected: data.connected || false,
                    store_url: data.store_url || data.storeUrl || '',
                    userId: data.userId || null,
                    consumerKey: data.consumerKey || '',
                    consumerSecret: data.consumerSecret || '',
                    webhookStatus: data.webhookStatus || 'inactive',
                    webhookSecret: data.webhookSecret || '',
                    updatedAt: data.updatedAt || data.createdAt
                });

                if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }));

                setFormData(prev => ({
                    ...prev,
                    storeUrl: data.store_url || data.storeUrl || prev.storeUrl,
                    consumerKey: data.consumerKey === '******' ? prev.consumerKey : (data.consumerKey || prev.consumerKey),
                    consumerSecret: data.consumerSecret === '******' ? prev.consumerSecret : (data.consumerSecret || prev.consumerSecret)
                }));
            }
        } catch (err) {
            console.error('WooCommerce status error:', err);
        } finally { setLoading(false); }
    };

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/templates');
            const data = res.data?.templates || res.data?.data || [];
            setTemplates(Array.isArray(data) ? data : []);
        } catch (err) { console.error('Failed to load templates:', err); }
    };

    useEffect(() => {
        fetchStatus();
        fetchTemplates();
    }, []);

    const handleInputChange = (e) => {
        e.stopPropagation();
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSettingChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleConnect = async (e) => {
        e.preventDefault();
        setConnecting(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const formattedData = { ...formData, storeUrl: formData.storeUrl.startsWith('http') ? formData.storeUrl : `https://${formData.storeUrl}` };
            const res = await api.post('/woocommerce/integration', formattedData);
            if (res.data.success) {
                setSuccessMessage('WooCommerce store synchronized!');
                await refreshStatus();
                fetchStatus();
            } else { setErrorMessage(res.data.error || 'Connection failed'); }
        } catch (err) {
            setErrorMessage(err.response?.data?.error || 'Failed to connect WooCommerce');
        } finally { setConnecting(false); }
    };

    const handleDisconnect = async () => {
        if (!window.confirm('Disconnect your WooCommerce store?')) return;
        setConnecting(true);
        try {
            const res = await api.post('/woocommerce/disconnect');
            if (res.data.success) {
                setSuccessMessage('Store disconnected');
                setIntegration(null);
                setFormData({ storeUrl: '', consumerKey: '', consumerSecret: '' });
                await refreshStatus();
                fetchStatus();
            }
        } catch (err) {
            setErrorMessage('Failed to disconnect');
        } finally { setConnecting(false); }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setConnecting(true);
        try {
            const res = await api.post('/woocommerce/settings', { settings });
            if (res.data.success) setSuccessMessage('Automation protocols updated!');
        } catch (err) {
            setErrorMessage('Failed to update settings');
        } finally { setConnecting(false); }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-24">
                <FiRefreshCw className="w-10 h-10 text-purple-500 animate-spin" />
            </div>
        );
    }

    const isConnected = integration?.connected === true;
    const webhookUrlValue = `${import.meta.env.VITE_SERVER_URL}/api/webhook/woocommerce/${integration?.userId || userIdForWebhook}`;

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-16 font-poppins">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-white rounded-[24px] p-6 border border-slate-200/60 shadow-sm group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-all duration-1000">
                    <FiShoppingCart size={120} />
                </div>
                <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-4 bg-gradient-to-br from-[#7F54B3] to-[#96588A] text-white rounded-2xl shadow-lg shadow-purple-500/10">
                                <FiShoppingCart size={28} strokeWidth={2.5} />
                            </div>
                            <div className="space-y-0.5">
                                <h2 className="text-2xl font-semibold text-slate-900 tracking-tight font-poppins">WooCommerce</h2>
                                <div className="flex items-center gap-2">
                                    <div className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-purple-100">WordPress Logic</div>
                                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest opacity-50">• eCommerce Core</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-slate-500 leading-relaxed font-semibold text-[15px]">
                            Synchronize your WordPress store with Zepofy. Automate order confirmations and abandoned cart recovery with official REST API protocols.
                        </p>
                    </div>
                    <div>
                        {isConnected ? (
                            <div className="flex flex-col items-center xl:items-end gap-2 px-6 py-4 bg-blue-50/50 rounded-2xl border border-blue-100 shadow-sm">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-full text-[11px] font-bold border border-blue-100 shadow-sm uppercase tracking-widest font-poppins">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                    Store Linked
                                </div>
                                <span className="text-[9px] text-blue-600 font-bold uppercase tracking-[0.2em] opacity-60 font-poppins">Catalogue Synced</span>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-slate-100 text-slate-400 rounded-full text-[11px] font-bold uppercase tracking-widest border border-slate-200 font-poppins">
                                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                Not Integrated
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {isConnected ? (
                    <div className="space-y-10">
                        {/* Store Connection Detail */}
                        <div className="bg-white rounded-[24px] shadow-sm border border-slate-200/60 overflow-hidden group">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center px-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                        <FiGlobe className="text-purple-600" size={16} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="font-semibold text-slate-800 text-[16px] tracking-tight font-poppins">Store Connection</h3>
                                </div>
                                <button
                                    onClick={handleDisconnect}
                                    disabled={connecting}
                                    className="text-[10px] font-bold uppercase tracking-widest text-red-600 bg-white border border-red-100 px-5 py-2.5 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center gap-3 active:scale-95 font-poppins"
                                >
                                    Revoke Access
                                </button>
                            </div>
                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Target Store</div>
                                        <a href={integration.store_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-bold text-slate-900 group/link">
                                            <span className="truncate">{integration.store_url}</span>
                                            <FiExternalLink className="text-slate-300 group-hover/link:text-purple-600 transition-colors" />
                                        </a>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Consumer Identity</div>
                                        <div className="font-mono text-slate-500 font-semibold text-sm bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">ck_••••••••••••••••••••</div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Linked Date</div>
                                        <div className="font-semibold text-slate-900 text-[15px] px-1">
                                            {integration.updatedAt ? new Date(integration.updatedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Pending'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Automation Logic */}
                        <div className="bg-white rounded-[32px] shadow-sm border border-slate-200/60 overflow-hidden">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3">
                                <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                    <FiZap className="text-amber-500" size={18} strokeWidth={2.5} />
                                </div>
                                <h3 className="font-bold text-slate-800 text-lg tracking-tight">Workflow Automations</h3>
                            </div>
                            <form onSubmit={handleSaveSettings} className="p-8 space-y-8">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Abandoned Cart */}
                                    <div className="p-6 bg-slate-50/50 rounded-[28px] border border-slate-200/60 relative overflow-hidden group hover:border-orange-200 transition-all">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3.5 bg-orange-100 text-orange-600 rounded-[20px] shadow-sm group-hover:scale-110 transition-transform">
                                                    <FiShoppingCart size={22} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 tracking-tight">Cart Recovery</h4>
                                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Revenue Preservation</p>
                                                </div>
                                            </div>
                                            <div className="relative inline-block w-14 mr-2 align-middle select-none">
                                                <input type="checkbox" id="enableAbandonedCart" name="enableAbandonedCart" checked={settings.enableAbandonedCart} onChange={handleSettingChange} className="w-14 h-7 rounded-full appearance-none bg-slate-200 checked:bg-orange-500 transition-all cursor-pointer relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:w-5 after:h-5 after:rounded-full after:transition-all checked:after:left-8 shadow-inner" />
                                            </div>
                                        </div>
                                        {settings.enableAbandonedCart && (
                                            <div className="space-y-5 animate-in slide-in-from-top-4 duration-500">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Delay Strategy</label>
                                                    <div className="flex items-center gap-3 bg-white p-2 rounded-[18px] border border-slate-200">
                                                        <input type="number" name="abandonedCartDelay" value={settings.abandonedCartDelay} onChange={handleSettingChange} className="w-full px-5 py-3 outline-none font-bold text-slate-900" />
                                                        <span className="text-[11px] font-bold text-slate-400 uppercase px-4 whitespace-nowrap">Minutes</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Engagement Template</label>
                                                    <select name="abandonedCartTemplate" value={settings.abandonedCartTemplate} onChange={handleSettingChange} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-[18px] outline-none text-sm font-semibold text-slate-700 appearance-none shadow-sm" >
                                                        <option value="">Select Protocol...</option>
                                                        {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Order Confirmation */}
                                    <div className="p-8 bg-slate-50/50 rounded-[28px] border border-slate-200/60 relative overflow-hidden group hover:border-blue-200 transition-all">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3.5 bg-blue-100 text-blue-600 rounded-[20px] shadow-sm group-hover:scale-110 transition-transform">
                                                    <FiCheckCircle size={22} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 tracking-tight">Order Sync</h4>
                                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Real-time Receipts</p>
                                                </div>
                                            </div>
                                            <div className="relative inline-block w-14 mr-2 align-middle select-none">
                                                <input type="checkbox" id="enableOrderConfirmation" name="enableOrderConfirmation" checked={settings.enableOrderConfirmation} onChange={handleSettingChange} className="w-14 h-7 rounded-full appearance-none bg-slate-200 checked:bg-blue-600 transition-all cursor-pointer relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:w-5 after:h-5 after:rounded-full after:transition-all checked:after:left-8 shadow-inner" />
                                            </div>
                                        </div>
                                        {settings.enableOrderConfirmation && (
                                            <div className="space-y-5 animate-in slide-in-from-top-4 duration-500">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Confirmation Template</label>
                                                    <select name="orderConfirmationTemplate" value={settings.orderConfirmationTemplate} onChange={handleSettingChange} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-[18px] outline-none text-sm font-semibold text-slate-700 appearance-none shadow-sm" >
                                                        <option value="">Select Protocol...</option>
                                                        {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                                    </select>
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-semibold italic ml-1">Triggers instantly upon "Order Created" webhook.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button type="submit" className="px-10 py-5 bg-slate-900 text-white rounded-[24px] font-bold hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 active:scale-95">
                                        {connecting ? <FiRefreshCw className="animate-spin" /> : <FiZap className="text-yellow-400" />}
                                        Preserve All Automation Settings
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Webhook Shield */}
                        <div className="bg-white rounded-[32px] shadow-sm border border-slate-200/60 overflow-hidden">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                        <FiActivity className="text-indigo-600" size={18} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-lg tracking-tight">Signal Configuration</h3>
                                </div>
                                <div className={`px-5 py-2 rounded-full text-[10px] font-bold border uppercase tracking-[0.2em] flex items-center gap-2.5 ${integration.webhookStatus === 'active' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                    <div className={`w-2 h-2 rounded-full ${integration.webhookStatus === 'active' ? 'bg-indigo-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                    {integration.webhookStatus === 'active' ? 'Signal Active' : 'Signal Pending'}
                                </div>
                            </div>
                            <div className="p-8 space-y-8">
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Webhook Intelligence URL</label>
                                        <div className="flex gap-3">
                                            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-[20px] px-6 py-4.5 font-mono text-xs text-slate-500 truncate select-all">{webhookUrlValue}</div>
                                            <button onClick={() => { navigator.clipboard.writeText(webhookUrlValue); setSuccessMessage('URL Secured!'); }} className="px-6 py-4 bg-slate-900 text-white rounded-[20px] font-bold hover:bg-black transition-all shadow-lg active:scale-95"><FiCopy /></button>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Secure Sign Secret</label>
                                        <div className="flex gap-3">
                                            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-[20px] px-6 py-4.5 font-mono text-xs text-slate-500 truncate select-all">{integration.webhookSecret || 'Handshake pending...'}</div>
                                            <button onClick={() => { if (integration.webhookSecret) { navigator.clipboard.writeText(integration.webhookSecret); setSuccessMessage('Secret Secured!'); } }} className="px-6 py-4 bg-white text-slate-900 border border-slate-200 rounded-[20px] font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"><FiCopy /></button>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-8 bg-slate-900 rounded-[28px] text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-8 opacity-10"><FiInfo size={80} /></div>
                                    <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><FiZap className="text-orange-400" /> Synchronization Protocol</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 opacity-80">
                                        <div className="space-y-2">
                                            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">WordPress Side Setup</p>
                                            <p className="text-[13px] leading-relaxed font-semibold text-slate-300">
                                                Go to WooCommerce &rarr; Settings &rarr; Advanced &rarr; <b>Webhooks</b>. Add a new webhook with status <b>'Active'</b> and Topic <b>'Order Created'</b>.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Activation Link</p>
                                            <p className="text-[13px] leading-relaxed font-semibold text-slate-300">
                                                Paste the <b>Webhook URL</b> from above into the 'Delivery URL' field in WooCommerce and save.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Connection Form for Disconnected State */
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                        <div className="xl:col-span-7 bg-white rounded-[32px] shadow-sm border border-slate-200/60 overflow-hidden">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/30">
                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-3 tracking-tight"><FiSettings className="text-purple-600" /> Source Configuration</h3>
                            </div>
                            <form onSubmit={handleConnect} className="p-8 space-y-8">
                                <div className="space-y-3">
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Store Base URL*</label>
                                    <input type="url" name="storeUrl" value={formData.storeUrl} onChange={handleInputChange} placeholder="https://yourdomain.com" className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] focus:bg-white focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 outline-none transition-all font-bold" required />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Consumer Key*</label>
                                        <input type="text" name="consumerKey" value={formData.consumerKey} onChange={handleInputChange} placeholder="ck_..." className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] font-mono text-sm font-semibold outline-none" required />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Consumer Secret*</label>
                                        <input type="password" name="consumerSecret" value={formData.consumerSecret} onChange={handleInputChange} placeholder="cs_..." className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] font-mono text-sm font-semibold outline-none" required />
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button type="submit" disabled={connecting} className="w-full flex items-center justify-center gap-4 px-8 py-4 bg-slate-900 text-white rounded-[24px] font-bold text-lg hover:bg-purple-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 group hover:-translate-y-1">
                                        {connecting ? <FiRefreshCw className="animate-spin" /> : <FiZap className="group-hover:text-yellow-400 group-hover:scale-110 transition-all" />}
                                        Initialize Store Sync
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="xl:col-span-5 space-y-8">
                            <div className="bg-white rounded-[32px] shadow-sm border border-slate-200/60 p-8">
                                <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-3 tracking-tight"><FiKey className="text-orange-500" /> How to get API Keys?</h3>
                                <div className="space-y-6">
                                    {[
                                        { title: '1. Access Settings', desc: 'Login to WordPress Admin, go to <b>WooCommerce &rarr; Settings</b>.' },
                                        { title: '2. Open API Panel', desc: 'Select top <b>Advanced</b> tab, then click the <b>REST API</b> sub-menu.' },
                                        { title: '3. Create New Key', desc: 'Click <b>Add Key</b>, add a description like \"Zepofy\", and select a user.' },
                                        { title: '4. Set Permissions', desc: 'CRITICAL: Change permissions to <b>Read/Write</b> and click Generate.' },
                                        { title: '5. Final Bind', desc: 'Copy the <b>Consumer Key</b> and <b>Consumer Secret</b> into the form on the left.' }
                                    ].map((step, i) => (
                                        <div key={i} className="flex gap-5 p-4 bg-purple-50/50 rounded-[24px] border border-purple-100 transition-all hover:bg-white hover:shadow-md group">
                                            <div className="flex-shrink-0 w-10 h-10 bg-white text-purple-600 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm group-hover:bg-purple-600 group-hover:text-white transition-all">{i + 1}</div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 text-[13px] mb-1 uppercase tracking-tight">{step.title}</h4>
                                                <p className="text-[12px] text-slate-500 leading-relaxed font-semibold" dangerouslySetInnerHTML={{ __html: step.desc }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl shadow-slate-300 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><FiShield size={80} /></div>
                                <h4 className="font-bold text-xl mb-3 tracking-tight relative z-10">Enterprise Guard</h4>
                                <p className="text-[13px] text-slate-400 leading-relaxed font-semibold italic opacity-70 relative z-10">
                                    Secure handshake uses OAuth 1.0a HMAC-SHA256 signatures. Credentials and PII are masked and encrypted at the database layer.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WooCommerceIntegration;