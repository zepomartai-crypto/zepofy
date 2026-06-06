import React, { useState, useEffect } from 'react';
import { FiServer, FiRefreshCw, FiLink, FiCheckCircle, FiAlertCircle, FiShoppingBag, FiInfo, FiKey, FiZap, FiExternalLink, FiLock, FiShield, FiX, FiActivity, FiCopy, FiSettings, FiShoppingCart, FiSave, FiGlobe, FiCheck } from 'react-icons/fi';
import api from '../../api/api';
import { useIntegration } from '../../context/IntegrationContext';
import { useAuth } from '../../context/useAuth';
import toast from 'react-hot-toast';

const ShopifyIntegration = ({ successMessage, errorMessage, setSuccessMessage, setErrorMessage }) => {
    const { refreshStatus } = useIntegration();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [integration, setIntegration] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [copied, setCopied] = useState('');

    const [formData, setFormData] = useState({ store: '', client_id: '', client_secret: '' });

    const [settings, setSettings] = useState({
        enableOrderConfirmation: false,
        orderConfirmationTemplate: '',
        enableAbandonedCart: false,
        abandonedCartTemplate: '',
        abandonedCartDelay: 60
    });

    const fetchStatus = async () => {
        try {
            setLoading(true);
            const res = await api.get('/shopify/integration');
            if (res.data.success && res.data.connected) {
                const data = res.data.data;
                setIntegration(data);
                setFormData({
                    store: data.storeDomain?.split('.')[0] || '',
                    client_id: data.clientId || '',
                    client_secret: '••••••••••••••••'
                });

                if (data.settings) {
                    setSettings({
                        enableOrderConfirmation: data.settings.enableOrderConfirmation || false,
                        orderConfirmationTemplate: data.settings.orderConfirmationTemplate || '',
                        enableAbandonedCart: data.settings.enableAbandonedCart || false,
                        abandonedCartTemplate: data.settings.abandonedCartTemplate || '',
                        abandonedCartDelay: data.settings.abandonedCartDelay || 60
                    });
                }
            }
        } catch (err) {
            console.error('Failed to fetch Shopify status:', err);
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
            const res = await api.post('/shopify/integration', formData);
            if (res.data.success) {
                setSuccessMessage('Shopify store synchronized successfully!');
                await refreshStatus();
                fetchStatus();
            } else { setErrorMessage(res.data.error || 'Connection failed'); }
        } catch (err) {
            setErrorMessage(err.response?.data?.error || 'Failed to connect Shopify');
        } finally { setConnecting(false); }
    };

    const handleDisconnect = async () => {
        if (!window.confirm('Are you sure you want to disconnect Shopify?')) return;
        setConnecting(true);
        try {
            const res = await api.post('/shopify/disconnect');
            if (res.data.success) {
                setSuccessMessage('Shopify disconnected');
                setIntegration(null);
                setFormData({ store: '', client_id: '', client_secret: '' });
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
            const res = await api.post('/shopify/settings', { settings });
            if (res.data.success) setSuccessMessage('Automation protocols updated!');
        } catch (err) {
            setErrorMessage('Failed to save settings');
        } finally { setConnecting(false); }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-24">
                <FiRefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
            </div>
        );
    }

    const isConnected = !!integration;

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-16 font-poppins">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-white rounded-[24px] p-6 border border-slate-200/60 shadow-sm group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-all duration-1000">
                    <FiServer size={120} />
                </div>
                <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-4 bg-gradient-to-br from-[#95BF47] to-[#5E8E3E] text-white rounded-2xl shadow-lg shadow-emerald-500/10">
                                <FiServer size={28} strokeWidth={2.5} />
                            </div>
                            <div className="space-y-0.5">
                                <h2 className="text-2xl font-semibold text-slate-900 tracking-tight font-poppins">Shopify</h2>
                                <div className="flex items-center gap-2">
                                    <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-100">App Bridge Sync</div>
                                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest opacity-50">• Direct Store Protocol</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-slate-500 leading-relaxed font-semibold text-[15px]">
                            Connect your Shopify store using Private App credentials to automate WhatsApp order updates and recover abandoned carts with native Shopify triggers.
                        </p>
                    </div>
                    <div>
                        {isConnected ? (
                            <div className="flex flex-col items-center xl:items-end gap-2 px-6 py-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 shadow-sm">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-emerald-600 rounded-full text-[11px] font-bold border border-emerald-100 shadow-sm uppercase tracking-widest font-poppins">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    Sync Active
                                </div>
                                <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-[0.2em] opacity-60 font-poppins">Store Authenticated</span>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-slate-100 text-slate-400 rounded-full text-[11px] font-bold uppercase tracking-widest border border-slate-200 font-poppins">
                                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                Connection Link Required
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
                            <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center px-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                        <FiGlobe className="text-emerald-600" size={16} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="font-semibold text-slate-800 text-[16px] tracking-tight font-poppins">Active Instance</h3>
                                </div>
                                <button
                                    onClick={handleDisconnect}
                                    disabled={connecting}
                                    className="text-[10px] font-bold uppercase tracking-widest text-red-600 bg-white border border-red-100 px-5 py-2.5 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center gap-3 active:scale-95 disabled:opacity-50 font-poppins"
                                >
                                    Terminate Link
                                </button>
                            </div>
                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Shopify Domain</div>
                                        <a href={`https://${integration.storeDomain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-bold text-slate-900 group/link">
                                            <span className="truncate">{integration.storeDomain}</span>
                                            <FiExternalLink className="text-slate-300 group-hover/link:text-emerald-600 transition-colors" />
                                        </a>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">API Privilege</div>
                                        <div className="font-mono text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 inline-block">Read / Write Access</div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Status Updated</div>
                                        <div className="font-semibold text-slate-900 text-[15px] px-1">
                                            {integration.updatedAt ? new Date(integration.updatedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Initial Sync'}
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
                                <h3 className="font-bold text-slate-800 text-lg tracking-tight">Automation Engine</h3>
                            </div>
                            <form onSubmit={handleSaveSettings} className="p-8 space-y-8">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Abandoned Cart */}
                                    <div className="p-6 bg-slate-50/50 rounded-[28px] border border-slate-200/60 relative overflow-hidden group hover:border-emerald-200 transition-all">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3.5 bg-emerald-100 text-emerald-600 rounded-[20px] shadow-sm group-hover:scale-110 transition-transform">
                                                    <FiShoppingBag size={22} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 tracking-tight">Checkout Recovery</h4>
                                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Shopify Webhook Logic</p>
                                                </div>
                                            </div>
                                            <div className="relative inline-block w-14 mr-2 align-middle select-none">
                                                <input type="checkbox" id="enableAbandonedCart" name="enableAbandonedCart" checked={settings.enableAbandonedCart} onChange={handleSettingChange} className="w-14 h-7 rounded-full appearance-none bg-slate-200 checked:bg-emerald-600 transition-all cursor-pointer relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:w-5 after:h-5 after:rounded-full after:transition-all checked:after:left-8 shadow-inner" />
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
                                                        <option value="">Select Template Protocol...</option>
                                                        {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Order Confirmation */}
                                    <div className="p-6 bg-slate-50/50 rounded-[28px] border border-slate-200/60 relative overflow-hidden group hover:border-blue-200 transition-all">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3.5 bg-blue-100 text-blue-600 rounded-[20px] shadow-sm group-hover:scale-110 transition-transform">
                                                    <FiCheckCircle size={22} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 tracking-tight">Purchase Sync</h4>
                                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Native Confirmation</p>
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
                                                        <option value="">Select Template Protocol...</option>
                                                        {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                                    </select>
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-semibold italic ml-1">Triggers on Shopify signals.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button type="submit" disabled={connecting} className="px-10 py-5 bg-slate-900 text-white rounded-[24px] font-bold hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
                                        {connecting ? <FiRefreshCw className="animate-spin" /> : <FiZap className="text-yellow-400" />}
                                        Update Shopify Workflow Protocols
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                ) : (
                    /* Connection Form for Disconnected State */
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-12 xl:col-span-7 bg-white rounded-[32px] shadow-sm border border-slate-200/60 overflow-hidden">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/30">
                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-3 tracking-tight"><FiSettings className="text-emerald-600" /> API Configuration</h3>
                            </div>
                            <form onSubmit={handleConnect} className="p-8 space-y-8">
                                <div className="space-y-3">
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Shopify Store Subdomain*</label>
                                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-[20px] px-6 py-4.5 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/5 focus-within:border-emerald-500 transition-all">
                                        <input type="text" name="store" value={formData.store} onChange={handleInputChange} placeholder="your-store-name" className="flex-1 bg-transparent outline-none font-bold text-slate-900" required />
                                        <span className="text-slate-400 font-bold text-sm">.myshopify.com</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">API Key (Client ID)*</label>
                                        <input type="text" name="client_id" value={formData.client_id} onChange={handleInputChange} placeholder="Enter Client ID" className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] font-mono text-sm font-semibold outline-none" required />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Admin API Access Token*</label>
                                        <input type="password" name="client_secret" value={formData.client_secret} onChange={handleInputChange} placeholder="shpat_..." className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-[20px] font-mono text-sm font-semibold outline-none" required />
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button type="submit" disabled={connecting} className="w-full flex items-center justify-center gap-4 px-10 py-5 bg-slate-900 text-white rounded-[24px] font-bold text-lg hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 group hover:-translate-y-1">
                                        {connecting ? <FiRefreshCw className="animate-spin" /> : <FiZap className="group-hover:text-yellow-400 group-hover:scale-110 transition-all" />}
                                        Initialize Shopify Sync Engine
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="lg:col-span-12 xl:col-span-5 space-y-8">
                            <div className="bg-white rounded-[32px] shadow-sm border border-slate-200/60 p-8">
                                <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-3 tracking-tight"><FiKey className="text-blue-500" /> How to get Shopify Keys?</h3>
                                <div className="space-y-6">
                                    {[
                                        { title: '1. Access Settings', desc: 'Login to Shopify Admin, go to <b>Settings &rarr; Apps and sales channels</b>.' },
                                        { title: '2. Develop App', desc: 'Click <b>Develop apps</b>, then <b>Create an app</b>. Set a name like \"Zepofy\".' },
                                        { title: '3. Configure Scopes', desc: 'Add <b>write_orders, read_orders</b> and <b>write_checkouts</b> in Admin API scopes.' },
                                        { title: '4. Install App', desc: 'Go to \"API credentials\", click <b>Install app</b>, and confirm installation.' },
                                        { title: '5. Bind Token', desc: 'Copy the <b>API Key</b> and the <b>Admin API Access Token</b> into the form on the left.' }
                                    ].map((step, i) => (
                                        <div key={i} className="flex gap-5 p-4 bg-emerald-50/50 rounded-[24px] border border-emerald-100 transition-all hover:bg-white hover:shadow-md group">
                                            <div className="flex-shrink-0 w-10 h-10 bg-white text-emerald-600 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all">{i + 1}</div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 text-[13px] mb-1 uppercase tracking-tight">{step.title}</h4>
                                                <p className="text-[12px] text-slate-500 leading-relaxed font-semibold" dangerouslySetInnerHTML={{ __html: step.desc }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl shadow-slate-300 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-10"><FiCheckCircle size={80} /></div>
                                <h4 className="font-bold text-xl mb-3 tracking-tight relative z-10">Global Security</h4>
                                <p className="text-[13px] text-slate-400 leading-relaxed font-semibold italic opacity-70 relative z-10">
                                    We use official Shopify Graph API v2024-04. All access tokens are vaulted with end-to-end encryption and never exposed in client sessions.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShopifyIntegration;
