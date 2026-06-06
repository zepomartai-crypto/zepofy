import React, { useState, useEffect } from 'react';
import {
  FiZap,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiSend,
  FiDollarSign,
  FiPercent,
  FiUsers,
  FiShoppingCart,
  FiActivity,
  FiInfo,
  FiSearch,
  FiFilter,
  FiChevronDown,
  FiCopy,
  FiGift,
  FiAlertCircle,
  FiMessageSquare,
  FiEye,
  FiPause,
  FiPlay,
  FiTrendingUp,
  FiSliders,
  FiCheck
} from 'react-icons/fi';
import api from '../api/api';
import toast from 'react-hot-toast';
import { cn } from '../utils/cn';
import DensitySelector from '../components/UI/DensitySelector';

export default function WooCommerceRepeatPurchase() {
  // Navigation tabs: 'dashboard', 'workflow', 'opportunities'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingManual, setSendingManual] = useState({});
  
  // Data States
  const [stats, setStats] = useState({
    totalRepeatCustomers: 0,
    automatedRemindersSent: 0,
    recoveredOrders: 0,
    repeatRevenueGenerated: 0,
    pendingOpportunities: 0,
    whatsappConversionRate: 0,
    topProducts: []
  });

  const [opportunities, setOpportunities] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    pages: 1
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Integration & Settings States
  const [templates, setTemplates] = useState([]);
  const [settings, setSettings] = useState({
    enabled: false,
    reorderDays: 30,
    onlyCompleted: true,
    excludeCancelled: true,
    excludeRefunded: true,
    onlyWhatsappVerified: false,
    minOrderAmount: 0,
    whatsappTemplate: 'repeat_purchase_reminder',
    enableCoupon: false,
    couponCode: 'REORDER10',
    couponDiscount: 10,
    couponExpiryDays: 7,
    maxReminders: 2,
    smartProductDetection: true,
    quietHoursEnabled: true,
    reorderButtonAction: 'reorder', // reorder, view, add_to_cart
    categoryFilters: '',
    specificProducts: '',
    eligibleTags: ''
  });

  // Load stats, settings, templates, and opportunities
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch settings
      try {
        const settingsRes = await api.get('/woocommerce/repeat-purchase/settings');
        if (settingsRes.data.success && settingsRes.data.data) {
          setSettings(prev => ({ ...prev, ...settingsRes.data.data }));
        }
      } catch (err) {
        console.error('Failed to load repeat purchase settings:', err);
      }

      // 2. Fetch stats
      try {
        const statsRes = await api.get('/woocommerce/repeat-purchase/stats');
        if (statsRes.data.success && statsRes.data.data) {
          setStats(statsRes.data.data);
        }
      } catch (err) {
        console.error('Failed to load repeat purchase stats:', err);
      }

      // 3. Fetch templates
      try {
        const templatesRes = await api.get('/templates');
        const templatesData = templatesRes.data?.templates || templatesRes.data?.data || [];
        setTemplates(Array.isArray(templatesData) ? templatesData : []);
      } catch (err) {
        console.error('Failed to load message templates:', err);
      }

      // 4. Fetch initial opportunities
      await fetchOpportunities(1, searchQuery, statusFilter);

    } catch (err) {
      console.error('Error synchronizing dashboard telemetry:', err);
      toast.error('Telemetry handshake incomplete');
    } finally {
      setLoading(false);
    }
  };

  const fetchOpportunities = async (page = 1, search = '', status = 'all') => {
    try {
      const res = await api.get('/woocommerce/repeat-purchase', {
        params: {
          page,
          limit: pagination.limit,
          search,
          status
        }
      });
      if (res.data.success) {
        setOpportunities(res.data.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load opportunities:', err);
      toast.error('Could not load opportunity table');
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Dropdown outside click closure
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.template-dropdown-container')) {
        setTemplateDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Handler for setting changes
  const handleSettingChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await api.post('/woocommerce/repeat-purchase/settings', { settings });
      if (res.data.success) {
        toast.success('Automation parameters locked successfully!');
        // Refresh opportunities lists since cycle days or rules might have recalculated
        await fetchOpportunities(1, searchQuery, statusFilter);
        // Refresh stats
        const statsRes = await api.get('/woocommerce/repeat-purchase/stats');
        if (statsRes.data.success && statsRes.data.data) {
          setStats(statsRes.data.data);
        }
      } else {
        toast.error(res.data.error || 'Failed to update automation parameters');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Connection timeout saving parameters');
    } finally {
      setSavingSettings(false);
    }
  };

  // Sync WooCommerce orders manual trigger
  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/woocommerce/repeat-purchase/sync');
      if (res.data.success) {
        toast.success(`Sync complete! Synced: ${res.data.data?.synced || 0} items, Converted: ${res.data.data?.converted || 0} orders`);
        // Refresh stats and opportunities
        await loadDashboardData();
      } else {
        toast.error(res.data.error || 'Manual synchronization aborted');
      }
    } catch (err) {
      console.error('Failed to trigger manual sync:', err);
      toast.error('Sync failed: Check WooCommerce credentials');
    } finally {
      setSyncing(false);
    }
  };

  // Send manual reminder message
  const handleSendReminder = async (id) => {
    setSendingManual(prev => ({ ...prev, [id]: true }));
    try {
      const res = await api.post(`/woocommerce/repeat-purchase/reminder/${id}`);
      if (res.data.success) {
        toast.success('WhatsApp reorder notification fired!');
        // Refresh opportunities
        await fetchOpportunities(pagination.page, searchQuery, statusFilter);
        // Refresh stats
        const statsRes = await api.get('/woocommerce/repeat-purchase/stats');
        if (statsRes.data.success && statsRes.data.data) {
          setStats(statsRes.data.data);
        }
      } else {
        toast.error(res.data.error || 'WhatsApp message rejected');
      }
    } catch (err) {
      console.error('Failed to send reminder:', err);
      toast.error('WhatsApp API dispatch failed');
    } finally {
      setSendingManual(prev => ({ ...prev, [id]: false }));
    }
  };

  // Handle live search
  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    fetchOpportunities(1, query, statusFilter);
  };

  // Handle status filter changes
  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    fetchOpportunities(1, searchQuery, status);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <FiRefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hydrating Automation Telemetry...</p>
        </div>
      </div>
    );
  }

  // Predefined Message Examples for visual builder
  const messageExamples = [
    {
      id: 1,
      title: "Consumable Reorder",
      text: "Hi {{customer_name}} 👋\nLooks like your previous purchase of {{product_name}} may be running low.\nTap below to reorder instantly 🛒"
    },
    {
      id: 2,
      title: "Discount Incentive",
      text: "We saved your favorite products ❤️\nReorder {{product_name}} now and get an exclusive discount. Use {{coupon_code}} for 10% off!"
    },
    {
      id: 3,
      title: "Limited Inventory Stock Alert",
      text: "Your previous purchase {{product_name}} is available again 🔥\nOrder now before stock runs out."
    }
  ];

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] overflow-y-auto font-poppins text-slate-900 custom-scrollbar p-6">
      
      {/* Top Banner Header */}
      <div className="relative overflow-hidden bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm mb-6 group shrink-0">
        <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-all duration-1000">
          <FiZap size={140} />
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-4 mb-3">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl shadow-lg shadow-indigo-500/10">
                <FiRefreshCw size={24} className="animate-spin-slow" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">🛒 Repeat Purchase Automation</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[9px] font-bold uppercase tracking-wider">WooCommerce</span>
                  <span className="text-[10px] text-slate-400 font-semibold">• Autonomous Retention Flow</span>
                </div>
              </div>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed font-semibold">
              Scan purchase cycles automatically, predict consumption timetables, and fire personalized WhatsApp reorder links to scale recurring revenue with zero manual overhead.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {/* Master Toggle Status Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Automation Engine</span>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider",
                settings.enabled 
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                  : "bg-amber-50 text-amber-600 border border-amber-100"
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full", settings.enabled ? "bg-emerald-500 animate-pulse" : "bg-amber-500")}></div>
                {settings.enabled ? "Active" : "Paused"}
              </span>
            </div>

            {/* Sync Button */}
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="px-4.5 py-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 tracking-wide transition-all shadow-sm active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <FiRefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin text-indigo-600")} />
              {syncing ? 'Scanning Cycles...' : 'Sync Opportunities'}
            </button>

            {/* Save Configs Button */}
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-5 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-indigo-600 transition-all shadow-sm active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              {savingSettings ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}
              Save Workflows
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-1.5 bg-slate-200/60 p-1.5 rounded-2xl mb-6 w-full md:w-max shadow-inner shrink-0">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer",
            activeTab === 'dashboard' 
              ? "bg-white text-slate-900 shadow-sm" 
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <FiTrendingUp className="w-4 h-4" />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('workflow')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer",
            activeTab === 'workflow' 
              ? "bg-white text-slate-900 shadow-sm" 
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <FiSliders className="w-4 h-4" />
          Workflow Settings
        </button>
        <button
          onClick={() => setActiveTab('opportunities')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer",
            activeTab === 'opportunities' 
              ? "bg-white text-slate-900 shadow-sm" 
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <FiUsers className="w-4 h-4" />
          Opportunities List
        </button>
      </div>

      {/* TAB CONTENTS */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Analytics Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            
            {/* CARD 1: Repeat Customers */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between h-[130px] relative overflow-hidden hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Repeat Customers</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FiUsers size={16} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 leading-none mb-1">{stats.totalRepeatCustomers}</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Unique multi-buyers</p>
              </div>
            </div>

            {/* CARD 2: Reminders Sent */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between h-[130px] relative overflow-hidden hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reminders Sent</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FiSend size={16} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 leading-none mb-1">{stats.automatedRemindersSent}</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">WhatsApp notifications</p>
              </div>
            </div>

            {/* CARD 3: Recovered Orders */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between h-[130px] relative overflow-hidden hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recovered Orders</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FiCheckCircle size={16} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 leading-none mb-1">{stats.recoveredOrders}</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Attributed reorders</p>
              </div>
            </div>

            {/* CARD 4: Repeat Revenue */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between h-[130px] relative overflow-hidden hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recovered Revenue</span>
                <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                  <FiDollarSign size={16} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 leading-none mb-1">
                  ₹{stats.repeatRevenueGenerated.toLocaleString('en-IN')}
                </h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Recurring sales total</p>
              </div>
            </div>

            {/* CARD 5: Pending Opportunities */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between h-[130px] relative overflow-hidden hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Opportunities</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <FiClock size={16} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 leading-none mb-1">{stats.pendingOpportunities}</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Next reorder cycles</p>
              </div>
            </div>

            {/* CARD 6: Conversion Rate */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between h-[130px] relative overflow-hidden hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WhatsApp Conversion</span>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <FiPercent size={16} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 leading-none mb-1">{stats.whatsappConversionRate}%</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Reorder conversion rate</p>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* Top Performing Repeated Products */}
            <div className="xl:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <FiShoppingCart size={18} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">Top Repeated Products</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cycle Velocity</span>
              </div>

              {stats.topProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <FiShoppingCart size={32} className="text-slate-300 mb-3" />
                  <p className="text-xs font-bold text-slate-500">No repeat orders aggregated yet</p>
                  <p className="text-[10px] text-slate-400 max-w-[240px] mt-1 font-semibold leading-relaxed">
                    Trigger WooCommerce sync above to detect multi-purchases from your order logs.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product Name</th>
                        <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Repeat Buyers</th>
                        <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Recovered Orders</th>
                        <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Revenue Generated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {stats.topProducts.map((p, idx) => (
                        <tr key={idx} className="group hover:bg-slate-50/50 transition-all">
                          <td className="py-3.5 text-xs font-bold text-slate-800">{p.name}</td>
                          <td className="py-3.5 text-xs font-semibold text-slate-500 text-center">{p.count} customers</td>
                          <td className="py-3.5 text-center">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">
                              <FiCheckCircle size={10} />
                              {p.conversions} orders
                            </span>
                          </td>
                          <td className="py-3.5 text-xs font-bold text-slate-800 text-right">
                            ₹{p.revenue.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* AI Suggestions Sidebar */}
            <div className="xl:col-span-4 space-y-6">
              {/* AI Smart Card */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12">
                  <FiZap size={90} />
                </div>
                
                <div className="flex items-center gap-2.5 mb-4 relative z-10">
                  <div className="p-1.5 bg-amber-400/20 text-amber-400 rounded-lg">
                    <FiZap size={16} />
                  </div>
                  <h4 className="font-bold text-xs uppercase tracking-widest text-amber-400">AI SMART SUGGESTIONS</h4>
                </div>

                <h3 className="text-sm font-bold tracking-tight mb-3 relative z-10 leading-relaxed">
                  Enhance Reorder Velocity on Consumables
                </h3>

                <div className="space-y-4 text-xs leading-relaxed font-semibold opacity-90 relative z-10">
                  <div className="space-y-1 p-3 bg-white/5 border border-white/10 rounded-xl">
                    <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Optimal Reorder Timing</p>
                    <p className="text-slate-200">
                      Sync analytics show **supplements & beauty items** reorder at an average of **38 days**. We suggest tweaking default cycle to 35-40 days.
                    </p>
                  </div>
                  <div className="space-y-1 p-3 bg-white/5 border border-white/10 rounded-xl">
                    <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Discount Efficiency</p>
                    <p className="text-slate-200">
                      Reorder coupons offering **10% OFF** (`REORDER10`) convert 2.4x higher than standard VIP templates with no coupons.
                    </p>
                  </div>
                  <div className="space-y-1 p-3 bg-white/5 border border-white/10 rounded-xl">
                    <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">WhatsApp Engagement Peak</p>
                    <p className="text-slate-200">
                      Highest click rates recorded between **10:00 AM & 12:30 PM**. Keep Quiet Hours active to prevent odd hour pings.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {activeTab === 'workflow' && (
        <form onSubmit={handleSaveSettings} className="w-full space-y-6 animate-in fade-in duration-200">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* WORKFLOW AUTOMATION PARAMETERS */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FiActivity size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">⚡ Reorder Timing & Engine Toggle</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Automation Parameters</p>
                </div>
              </div>

              {/* Master Enabled Switch */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/50">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Master Automation Engine</h4>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Toggle all reorder workflows globally</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    name="enabled" 
                    checked={settings.enabled} 
                    onChange={handleSettingChange} 
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-slate-900 shadow-inner"></div>
                </label>
              </div>

              {/* Cycle presets */}
              <div className="space-y-2.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Default Reorder Period</label>
                <div className="grid grid-cols-5 gap-2">
                  {[7, 15, 30, 45, 60].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, reorderDays: days }))}
                      className={cn(
                        "py-3 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        settings.reorderDays === days
                          ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
                
                {/* Custom Days Input */}
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200/80 mt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Custom Timing:</span>
                  <input 
                    type="number" 
                    name="reorderDays" 
                    value={settings.reorderDays} 
                    onChange={handleSettingChange} 
                    className="w-full bg-transparent outline-none font-bold text-slate-900 text-sm" 
                  />
                  <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Days</span>
                </div>
              </div>

              {/* Smart Product Detection Badge */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3">
                <FiInfo className="text-blue-500 shrink-0 mt-0.5" size={16} />
                <div>
                  <h4 className="text-xs font-bold text-blue-900">🧠 Smart Product Detection</h4>
                  <p className="text-[10px] text-blue-700 leading-relaxed font-semibold mt-1">
                    If a customer has previously bought a product multiple times, the engine overrides the default timing set above and automatically computes their personalized reorder frequency.
                  </p>
                </div>
              </div>
            </div>

            {/* AUTOMATION FILTERS / CONDITIONS */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                  <FiFilter size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">✅ Automation Rules & Filters</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Eligibility Criteria</p>
                </div>
              </div>

              <div className="space-y-3.5">
                <label className="relative flex items-start gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    name="onlyCompleted" 
                    checked={settings.onlyCompleted} 
                    onChange={handleSettingChange} 
                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Only completed orders</span>
                    <p className="text-[10px] text-slate-400 font-medium">Trigger reminders only for fully dispatched products</p>
                  </div>
                </label>

                <label className="relative flex items-start gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    name="excludeCancelled" 
                    checked={settings.excludeCancelled} 
                    onChange={handleSettingChange} 
                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Exclude cancelled orders</span>
                    <p className="text-[10px] text-slate-400 font-medium">Do not process reorders for failed or cancelled orders</p>
                  </div>
                </label>

                <label className="relative flex items-start gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    name="excludeRefunded" 
                    checked={settings.excludeRefunded} 
                    onChange={handleSettingChange} 
                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Exclude refunded orders</span>
                    <p className="text-[10px] text-slate-400 font-medium">Skip users who returned items or received refunds</p>
                  </div>
                </label>

                <label className="relative flex items-start gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    name="onlyWhatsappVerified" 
                    checked={settings.onlyWhatsappVerified} 
                    onChange={handleSettingChange} 
                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Only WhatsApp verified customers</span>
                    <p className="text-[10px] text-slate-400 font-medium">Check number compatibility before firing alerts</p>
                  </div>
                </label>
              </div>

              {/* Threshold Fields */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Minimum Order Amount (₹)</label>
                  <input 
                    type="number" 
                    name="minOrderAmount" 
                    value={settings.minOrderAmount} 
                    onChange={handleSettingChange} 
                    className="w-full bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200/80 outline-none text-xs font-bold text-slate-800" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Specific Products Only (Comma separated IDs)</label>
                  <input 
                    type="text" 
                    name="specificProducts" 
                    value={settings.specificProducts} 
                    onChange={handleSettingChange} 
                    placeholder="e.g. 102, 451, 882"
                    className="w-full bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200/80 outline-none text-xs font-semibold text-slate-800 placeholder-slate-400" 
                  />
                </div>
              </div>
            </div>

            {/* WHATSAPP CAMPAIGN INTEGRATION */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FiMessageSquare size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">💬 WhatsApp Campaign Settings</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Alert Template Mapping</p>
                </div>
              </div>

              {/* Template Dropdown */}
              <div className="space-y-1.5 relative template-dropdown-container">
                <DensitySelector
                  value={settings.whatsappTemplate}
                  onChange={(val) => setSettings(prev => ({ ...prev, whatsappTemplate: val }))}
                  options={[
                    { label: "Default (repeat_purchase_reminder)", value: "repeat_purchase_reminder" },
                    ...templates.map(t => ({ label: t.name, value: t.metaTemplateName || t.name }))
                  ]}
                  label=""
                />
              </div>

              {/* Message button action CTA */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Reorder Button Action</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'reorder', label: 'Reorder Now' },
                    { val: 'view', label: 'View Product' },
                    { val: 'add_to_cart', label: 'Buy Again' }
                  ].map((act) => (
                    <button
                      key={act.val}
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, reorderButtonAction: act.val }))}
                      className={cn(
                        "py-3 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        settings.reorderButtonAction === act.val
                          ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Example previews */}
              <div className="space-y-2 pt-2">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Message Examples</span>
                <div className="space-y-3 max-h-[190px] overflow-y-auto custom-scrollbar pr-1">
                  {messageExamples.map((ex) => (
                    <div key={ex.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl relative group">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">{ex.title}</p>
                      <p className="text-[10px] text-slate-600 font-semibold whitespace-pre-line leading-relaxed">{ex.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* COUPON AUTOMATION ENGINE */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <FiGift size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">🎁 Coupon Automation Engine</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Financial Incentives</p>
                </div>
              </div>

              {/* Coupon Enabled Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/50">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Auto-Generate Coupons</h4>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Issue individual coupons for reorders</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    name="enableCoupon" 
                    checked={settings.enableCoupon} 
                    onChange={handleSettingChange} 
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-slate-900 shadow-inner"></div>
                </label>
              </div>

              {settings.enableCoupon && (
                <div className="space-y-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Default Coupon Code</label>
                    <input 
                      type="text" 
                      name="couponCode" 
                      value={settings.couponCode} 
                      onChange={handleSettingChange} 
                      className="w-full bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200/80 outline-none text-xs font-bold text-slate-800" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Discount Percentage (%)</label>
                      <input 
                        type="number" 
                        name="couponDiscount" 
                        value={settings.couponDiscount} 
                        onChange={handleSettingChange} 
                        className="w-full bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200/80 outline-none text-xs font-bold text-slate-800" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Expiry Duration (Days)</label>
                      <input 
                        type="number" 
                        name="couponExpiryDays" 
                        value={settings.couponExpiryDays} 
                        onChange={handleSettingChange} 
                        className="w-full bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200/80 outline-none text-xs font-bold text-slate-800" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Quiet hours parameters */}
              <div className="space-y-3.5 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-800">Advanced Controls</h4>

                <label className="relative flex items-start gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    name="quietHoursEnabled" 
                    checked={settings.quietHoursEnabled} 
                    onChange={handleSettingChange} 
                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Enable smart quiet hours</span>
                    <p className="text-[10px] text-slate-400 font-medium">Prevent triggers between 9:00 PM & 9:00 AM local time</p>
                  </div>
                </label>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Max Reminders Per Opportunity</label>
                  <input 
                    type="number" 
                    name="maxReminders" 
                    value={settings.maxReminders} 
                    onChange={handleSettingChange} 
                    className="w-full bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200/80 outline-none text-xs font-bold text-slate-800" 
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Action CTA */}
          <div className="flex justify-end">
            <button 
              type="submit" 
              disabled={savingSettings}
              className="px-8 py-4.5 bg-slate-900 text-white rounded-3xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
            >
              {savingSettings ? (
                <FiRefreshCw className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <FiZap className="w-4.5 h-4.5 text-amber-400 fill-current" />
              )}
              Save Workflow Parameters
            </button>
          </div>

        </form>
      )}

      {activeTab === 'opportunities' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Opportunities Data Grid Table */}
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
            
            {/* Search + Filter Header */}
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
              
              {/* Search Bar */}
              <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 w-full md:max-w-md shadow-inner">
                <FiSearch className="text-slate-400" size={16} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={handleSearch}
                  placeholder="Search customer, product name, email..."
                  className="w-full bg-transparent outline-none text-xs font-semibold text-slate-800 placeholder-slate-400" 
                />
              </div>

              {/* Status Filters Tabbed Buttons */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'all', label: 'All Cycles' },
                  { key: 'pending', label: 'Pending reorders' },
                  { key: 'sent', label: 'WhatsApp Sent' },
                  { key: 'converted', label: 'Converted' },
                  { key: 'failed', label: 'Failed' }
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => handleStatusFilterChange(f.key)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border",
                      statusFilter === f.key
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Opportunities Table */}
            {opportunities.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-24">
                <FiUsers size={48} className="text-slate-300 mb-3" />
                <h4 className="text-xs font-bold text-slate-700 tracking-tight">No active reorder cycles found</h4>
                <p className="text-[10px] text-slate-400 max-w-[280px] mt-1 font-semibold leading-relaxed">
                  Try clearing your search filters, adjusting min order criteria, or syncing WooCommerce.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/20 border-b border-slate-100">
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Customer Details</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Product Purchased</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Cycle Days</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Reorder Due Date</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">WhatsApp Delivery</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Revenue</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60 font-poppins">
                    {opportunities.map((item) => {
                      const daysPassed = Math.round((new Date() - new Date(item.lastOrderDate)) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={item._id} className="group hover:bg-slate-50/50 transition-all">
                          {/* Customer */}
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-xs font-bold text-slate-800">{item.customerName}</p>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{item.customerEmail}</p>
                              {item.customerPhone && (
                                <p className="text-[9px] text-[#2056FF] font-bold tracking-wider mt-0.5">
                                  {item.customerPhone.startsWith('+') ? item.customerPhone : `+${item.customerPhone}`}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Product */}
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-xs font-bold text-slate-800 max-w-[200px] truncate">{item.productName}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                {item.productCategory || 'Default'}
                              </p>
                            </div>
                          </td>

                          {/* Cycle */}
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs font-bold text-slate-700">{item.reorderCycleDays} days</span>
                          </td>

                          {/* Due date */}
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-xs font-bold text-slate-700">
                                {new Date(item.reorderDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                {daysPassed >= item.reorderCycleDays ? (
                                  <span className="text-rose-500">Overdue by {daysPassed - item.reorderCycleDays}d</span>
                                ) : (
                                  <span className="text-emerald-600">Due in {item.reorderCycleDays - daysPassed}d</span>
                                )}
                              </p>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                              item.automationStatus === 'converted' && "bg-emerald-50 text-emerald-600 border-emerald-100",
                              item.automationStatus === 'sent' && "bg-indigo-50 text-indigo-600 border-indigo-100",
                              item.automationStatus === 'pending' && "bg-blue-50 text-blue-600 border-blue-100",
                              item.automationStatus === 'paused' && "bg-slate-100 text-slate-500 border-slate-200",
                              item.automationStatus === 'failed' && "bg-rose-50 text-rose-600 border-rose-100"
                            )}>
                              {item.automationStatus}
                            </span>
                          </td>

                          {/* Delivery Status */}
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                              item.whatsappDeliveryStatus === 'read' && "bg-blue-50 text-blue-600 border-blue-100",
                              item.whatsappDeliveryStatus === 'delivered' && "bg-teal-50 text-teal-600 border-teal-100",
                              item.whatsappDeliveryStatus === 'sent' && "bg-indigo-50 text-indigo-600 border-indigo-100",
                              item.whatsappDeliveryStatus === 'failed' && "bg-rose-50 text-rose-600 border-rose-100",
                              item.whatsappDeliveryStatus === 'pending' && "bg-slate-100 text-slate-400 border-slate-200"
                            )}>
                              {item.whatsappDeliveryStatus}
                            </span>
                          </td>

                          {/* Revenue */}
                          <td className="px-6 py-4 text-right">
                            <span className="text-xs font-bold text-slate-800">
                              {item.revenueGenerated > 0 ? `₹${item.revenueGenerated.toLocaleString('en-IN')}` : '-'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Manual Send Trigger */}
                              <button
                                onClick={() => handleSendReminder(item._id)}
                                disabled={sendingManual[item._id] || item.automationStatus === 'converted'}
                                className="p-2.5 bg-slate-900 text-white hover:bg-indigo-600 rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-40 flex items-center justify-center shrink-0 cursor-pointer"
                                title="Send WhatsApp Reorder Alert"
                              >
                                {sendingManual[item._id] ? (
                                  <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <FiSend className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/20">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Showing page {pagination.page} of {pagination.pages} ({pagination.total} opportunities)
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    disabled={pagination.page === 1}
                    onClick={() => fetchOpportunities(pagination.page - 1, searchQuery, statusFilter)}
                    className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.page === pagination.pages}
                    onClick={() => fetchOpportunities(pagination.page + 1, searchQuery, statusFilter)}
                    className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Thin scroll bar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4.5px; height: 4.5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .animate-spin-slow { animation: spin 10s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

    </div>
  );
}
