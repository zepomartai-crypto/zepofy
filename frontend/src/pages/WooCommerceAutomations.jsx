import React, { useState, useEffect } from 'react';
import {
  FiZap,
  FiShoppingCart,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiCopy,
  FiActivity,
  FiInfo,
  FiAlertCircle,
  FiChevronDown
} from 'react-icons/fi';
import api from '../api/api';
import toast from 'react-hot-toast';
import { cn } from '../utils/cn';
import DensitySelector from '../components/UI/DensitySelector';

export default function WooCommerceAutomations() {
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [integration, setIntegration] = useState(null);
  const [settings, setSettings] = useState({
    abandonedCartDelay: 60,
    enableAbandonedCart: false,
    abandonedCartTemplate: '',
    enableOrderConfirmation: false,
    orderConfirmationTemplate: ''
  });

  const fetchStatusAndTemplates = async () => {
    try {
      setLoading(true);

      // Fetch active integration status
      const integrationRes = await api.get('/woocommerce/integration');
      if (integrationRes.data.success && integrationRes.data.data) {
        const data = integrationRes.data.data;
        setIntegration({
          connected: data.connected || false,
          store_url: data.store_url || data.storeUrl || '',
          userId: data.userId || '',
          webhookStatus: data.webhookStatus || 'inactive',
          webhookSecret: data.webhookSecret || '',
          updatedAt: data.updatedAt || data.createdAt
        });

        if (data.settings) {
          setSettings(prev => ({ ...prev, ...data.settings }));
        }
      }

      // Fetch message templates
      const templatesRes = await api.get('/templates');
      const templatesData = templatesRes.data?.templates || templatesRes.data?.data || [];
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
    } catch (err) {
      console.error('Failed to load integration status or templates:', err);
      toast.error('Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndTemplates();
  }, []);

  const handleSettingChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await api.post('/woocommerce/settings', { settings });
      if (res.data.success) {
        toast.success('Automation configurations saved successfully!');
      } else {
        toast.error(res.data.error || 'Failed to update automation settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <FiRefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Hydrating Automation Panel...</p>
        </div>
      </div>
    );
  }

  const isConnected = integration?.connected === true;
  const webhookUrlValue = `${import.meta.env.VITE_SERVER_URL}/api/webhook/woocommerce/${integration?.userId}`;

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] overflow-y-auto font-poppins text-slate-900 custom-scrollbar p-6">

      {/* Header Banner */}
      <div className="relative overflow-hidden bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm mb-6 group shrink-0">
        <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-all duration-1000">
          <FiZap size={140} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-2xl shadow-lg shadow-amber-500/10">
                <FiZap size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Workflow Automations Hub</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[9px] font-bold uppercase tracking-wider">Automations</span>
                  <span className="text-[10px] text-slate-400 font-semibold">• Direct WooCommerce Integration</span>
                </div>
              </div>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed font-semibold">
              Manage automatic notifications and recovery workflows triggered by your WooCommerce store. Toggles can be configured and updated instantly.
            </p>
          </div>
          <div>
            {isConnected ? (
              <div className="inline-flex items-center gap-2.5 px-4.5 py-2 bg-blue-50/50 text-blue-600 border border-blue-100 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                Store Synced
              </div>
            ) : (
              <div className="inline-flex items-center gap-2.5 px-4.5 py-2 bg-slate-100 text-slate-400 border border-slate-200 rounded-full text-xs font-bold uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                Disconnected
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Automations Form Panel */}
        <div className="xl:col-span-8 space-y-6">

          <form onSubmit={handleSaveSettings} className="space-y-6">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Cart Recovery (Abandoned Cart) */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm relative group hover:border-orange-200 transition-all flex flex-col h-full">
                <div className="flex flex-col h-full">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-orange-50 text-orange-600 rounded-2xl border border-orange-100 shadow-sm group-hover:scale-105 transition-transform">
                          <FiShoppingCart size={22} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 tracking-tight text-sm">Cart Recovery</h4>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Revenue Preservation</p>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          name="enableAbandonedCart"
                          checked={settings.enableAbandonedCart}
                          onChange={handleSettingChange}
                          className="sr-only peer"
                        />
                        <div className="w-12 h-6.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-orange-500 shadow-inner"></div>
                      </label>
                    </div>

                    <p className="text-xs text-slate-400 font-medium mb-4">
                      Automatically trigger transactional WhatsApp templates to customers who drop off during the checkout stage.
                    </p>
                  </div>

                  {settings.enableAbandonedCart ? (
                    <div className="space-y-4 pt-4 border-t border-slate-100 flex flex-col animate-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Delay Strategy</label>
                        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200/80">
                          <input
                            type="number"
                            name="abandonedCartDelay"
                            value={settings.abandonedCartDelay}
                            onChange={handleSettingChange}
                            className="w-full bg-transparent outline-none font-bold text-slate-900 text-sm"
                          />
                          <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Minutes</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Engagement Template</label>

                        <DensitySelector
                          value={settings.abandonedCartTemplate}
                          onChange={(val) => setSettings(prev => ({ ...prev, abandonedCartTemplate: val }))}
                          options={[
                            { label: "Select template...", value: "" },
                            ...templates.map(t => ({ label: t.name, value: t._id }))
                          ]}
                          label=""
                          fullWidth={true}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 mt-2 animate-in fade-in duration-300">
                      <div className="w-12 h-12 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-white mb-2 shadow-inner">
                        <FiShoppingCart size={18} className="opacity-60" />
                      </div>
                      <h5 className="text-xs font-bold text-slate-700 tracking-tight">Recovery Workflow Paused</h5>
                      <p className="text-[10px] text-slate-400 font-semibold max-w-[200px] mt-1 leading-relaxed">
                        Enable Cart Recovery to automatically trigger recovery messages for abandoned checkouts.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Sync */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm relative group hover:border-blue-200 transition-all flex flex-col h-full">
                <div className="flex flex-col h-full">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm group-hover:scale-105 transition-transform">
                          <FiCheckCircle size={22} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 tracking-tight text-sm">Order Sync</h4>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Real-time Receipts</p>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          name="enableOrderConfirmation"
                          checked={settings.enableOrderConfirmation}
                          onChange={handleSettingChange}
                          className="sr-only peer"
                        />
                        <div className="w-12 h-6.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                      </label>
                    </div>

                    <p className="text-xs text-slate-400 font-medium mb-4">
                      Send immediate real-time receipts, confirmation notices, and order status updates to your customers via WhatsApp.
                    </p>
                  </div>

                  {settings.enableOrderConfirmation ? (
                    <div className="space-y-4 pt-4 border-t border-slate-100 flex flex-col animate-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1.5 relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Confirmation Template</label>

                        <DensitySelector
                          value={settings.orderConfirmationTemplate}
                          onChange={(val) => setSettings(prev => ({ ...prev, orderConfirmationTemplate: val }))}
                          options={[
                            { label: "Select template...", value: "" },
                            ...templates.map(t => ({ label: t.name, value: t._id }))
                          ]}
                          label=""
                          fullWidth={true}
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium italic ml-0.5 flex items-center gap-1.5 mt-2">
                        <FiInfo className="text-blue-500" /> Triggers instantly upon webhook notification.
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 mt-2 animate-in fade-in duration-300">
                      <div className="w-12 h-12 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-white mb-2 shadow-inner">
                        <FiCheckCircle size={18} className="opacity-60" />
                      </div>
                      <h5 className="text-xs font-bold text-slate-700 tracking-tight">Receipt Sync Paused</h5>
                      <p className="text-[10px] text-slate-400 font-semibold max-w-[200px] mt-1 leading-relaxed">
                        Enable Order Sync to send automated purchase receipts and order updates instantly.
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-8 py-4.5 bg-slate-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md active:scale-95 flex items-center justify-center gap-3"
              >
                {savingSettings ? (
                  <FiRefreshCw className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <FiZap className="w-4.5 h-4.5 text-yellow-400 fill-current animate-pulse" />
                )}
                Preserve Automation Settings
              </button>
            </div>

          </form>

        </div>

        {/* Info & Setup Sidecard */}
        <div className="xl:col-span-4 space-y-6">

          {/* Signal Configurations Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <FiActivity size={18} />
                </div>
                <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">Signal Setup</h3>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-[9px] font-bold border uppercase tracking-widest flex items-center gap-1.5",
                integration?.webhookStatus === 'active' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-amber-50 text-amber-600 border-amber-200'
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full", integration?.webhookStatus === 'active' ? 'bg-indigo-500' : 'bg-amber-500 animate-pulse')}></div>
                {integration?.webhookStatus === 'active' ? 'Active' : 'Pending'}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Webhook URL</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono text-[10px] text-slate-500 truncate select-all">
                    {webhookUrlValue}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(webhookUrlValue); toast.success('URL copied to clipboard!'); }}
                    className="p-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all active:scale-95 flex-shrink-0"
                    title="Copy URL"
                  >
                    <FiCopy size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Secure Signature Secret</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono text-[10px] text-slate-500 truncate select-all">
                    {integration?.webhookSecret || 'Handshake pending...'}
                  </div>
                  <button
                    onClick={() => {
                      if (integration?.webhookSecret) {
                        navigator.clipboard.writeText(integration.webhookSecret);
                        toast.success('Webhook Secret copied!');
                      }
                    }}
                    disabled={!integration?.webhookSecret}
                    className="p-3 bg-white text-slate-800 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95 flex-shrink-0 disabled:opacity-50"
                    title="Copy Secret"
                  >
                    <FiCopy size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Guide Setup */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-lg space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12">
              <FiInfo size={80} />
            </div>

            <h4 className="font-bold text-sm flex items-center gap-2 tracking-tight relative z-10">
              <FiInfo className="text-amber-400" /> Synchronization Steps
            </h4>

            <div className="space-y-5 text-xs leading-relaxed font-semibold opacity-90 relative z-10">
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">1. Open WooCommerce</p>
                <p className="text-slate-300">Login to WordPress, navigate to WooCommerce &rarr; Settings &rarr; Advanced &rarr; <b>Webhooks</b>.</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">2. Register Hook</p>
                <p className="text-slate-300">Click <b>Add Webhook</b>. Set Status to <b>'Active'</b>, Topic to <b>'Order Created'</b>.</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">3. Paste delivery url</p>
                <p className="text-slate-300">Copy Zepofy's Webhook URL from above and paste it into the 'Delivery URL' input, then save the webhook.</p>
              </div>
            </div>
          </div>

        </div>

      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4.5px; height: 4.5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

    </div>
  );
}
