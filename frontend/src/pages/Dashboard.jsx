import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/useAuth";
import toast from 'react-hot-toast';
import {
  FiSend, FiActivity, FiUsers, FiMessageSquare,
  FiTrendingUp, FiClock, FiRefreshCw, FiSettings,
  FiArrowRight, FiUserPlus, FiLayers, FiAlertCircle,
  FiMessageCircle, FiEdit2, FiGlobe, FiShoppingBag,
  FiPlay, FiShoppingCart, FiBarChart2, FiPieChart, FiBell
} from "react-icons/fi";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState({});
  const [performanceData, setPerformanceData] = useState([]);
  const [allCampaigns, setAllCampaigns] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [timeFilter, setTimeFilter] = useState("Week");
  const [chartType, setChartType] = useState("Area");

  const [integrationData, setIntegrationData] = useState(null);
  const [woocommerceIntegration, setWoocommerceIntegration] = useState(null);
  const [shopifyIntegration, setShopifyIntegration] = useState({ isConnected: false });
  const [flows, setFlows] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async (periodFilter = timeFilter) => {
    try {
      setRefreshing(true);

      const [analyticsRes, itemsRes, flowsRes] = await Promise.all([
        api.get("/dashboard/analytics").catch(() => ({ data: { success: false, data: {} } })),
        api.get(`/dashboard/messages-chart?period=${periodFilter}`).catch(() => ({ data: { success: false, data: [] } })),
        api.get("/flows").catch(() => ({ data: { flows: [] } }))
      ]);

      if (analyticsRes.data.success) {
        const analytics = analyticsRes.data.data;
        setDashboardData(analytics);
        setAllCampaigns(analytics.all_campaigns || []);

        if (analytics.whatsapp) {
          setIntegrationData({
            isConnected: analytics.whatsapp.connected,
            phoneNumber: analytics.whatsapp?.phone_number
          });
        }
        if (analytics.woocommerce) {
          setWoocommerceIntegration({
            isConnected: analytics.woocommerce.connected ?? false,
            stats: {
              orders: analytics.woocommerce.orders ?? 0,
              abandonedCarts: analytics.woocommerce.abandoned ?? 0
            }
          });
        }
        if (analytics.shopify) {
          setShopifyIntegration({
            isConnected: analytics.shopify.connected ?? false,
            stats: {
              orders: analytics.shopify.orders ?? 0,
              abandonedCheckouts: analytics.shopify.abandoned ?? 0
            }
          });
        }

        const chartData = itemsRes.data.data || [];
        setPerformanceData(chartData);

        const fetchedFlows = flowsRes.data.flows || [];
        setFlows(fetchedFlows);
      }

      // Fetch Activity once on initial load
      fetchActivity();

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeFilter]);

  const fetchActivity = async () => {
    try {
      const res = await api.get("/dashboard/recent-activity");
      if (res.data.success) {
        setRecentActivity(res.data.data || []);
      }
    } catch (err) {
      // ignore silently for background polling
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh activity stream every 10 seconds
    const interval = setInterval(fetchActivity, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      fetchData();
    };
    window.addEventListener('refreshDashboard', handleRefresh);
    return () => window.removeEventListener('refreshDashboard', handleRefresh);
  }, [fetchData]);

  const refreshAction = async () => {
    await fetchData();
  };

  const handleRunCampaign = async (e, campId) => {
    e.stopPropagation();
    try {
      toast.loading("Starting campaign...", { id: 'runCamp' });
      await api.post(`/campaigns/${campId}/run`);
      toast.success("Campaign started successfully", { id: 'runCamp' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to start campaign", { id: 'runCamp' });
    }
  };

  const handleDuplicateCampaign = async (e, campId) => {
    e.stopPropagation();
    try {
      toast.loading("Duplicating campaign...", { id: 'dupCamp' });
      await api.post(`/campaigns/${campId}/duplicate`);
      toast.success("Campaign duplicated", { id: 'dupCamp' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to duplicate campaign", { id: 'dupCamp' });
    }
  };

  // --- KPI Prep ---
  const summary = dashboardData?.summary || {};
  const totalCampaigns = dashboardData?.totalCampaigns ?? 0;
  const approvedTemplates = dashboardData?.templates?.approved ?? 0;
  const deliveryRate = Math.min(dashboardData?.deliveryRate ?? 0, 100);
  const readRate = Math.min(summary.readRate ?? 0, 100);
  const replyRate = Math.min(summary.replyRate ?? 0, 100);
  const messagesSentToday = summary.todayMessagesSent ?? 0;
  const messagesDeliveredToday = summary.todayMessagesDelivered ?? 0;
  const messagesReadToday = summary.todayMessagesRead ?? 0;
  const failedMessagesToday = summary.todayMessagesFailed ?? 0;
  const activeContacts = dashboardData?.contacts ?? 0; // Using total contacts as active

  // Funnel Data (Overall)
  const f_sent = dashboardData?.messagesSent ?? 0;
  const f_deliv = f_sent - (dashboardData?.summary?.totalFailed || 0); // approx safe
  // actually we dont have global delivered out of the box unless we sum it.
  // let's use the summary last 7 days vs overall. For the funnel, let's use last 7 days so it's fresh.
  const funnelSent = summary.last7DaysMessagesSent || 0;
  const funnelDeliv = summary.last7DaysMessagesDelivered || 0;
  const funnelRead = summary.last7DaysMessagesRead || 0;
  // Approximation for replies in last 7 days vs overall.

  const f_sent_d = dashboardData?.messagesSent || 0;
  const deliveryRateData = dashboardData?.deliveryRate || 0;
  const f_deliv_d = Math.round(f_sent_d * (deliveryRateData / 100));
  const readRateData = summary.readRate || 0;
  const f_read_d = Math.round(f_deliv_d * (readRateData / 100));
  const f_reply_d = summary.totalReplies || 0;

  const f_deliv_pct = f_sent_d > 0 ? Math.round((f_deliv_d / f_sent_d) * 100) : 0;
  const f_read_pct = f_deliv_d > 0 ? Math.round((f_read_d / f_deliv_d) * 100) : 0;
  const f_reply_pct = f_read_d > 0 ? Math.round((f_reply_d / f_read_d) * 100) : 0;

  // Alerts & Issues Detection
  const highFailureRate = summary.last7DaysDeliveryRate < 80 && summary.last7DaysMessagesSent > 50;
  const lowDeliveryWarning = summary.last7DaysDeliveryRate < 50 && summary.last7DaysMessagesSent > 10;
  const failedCampaigns = allCampaigns.filter(c => c.status === 'failed').length;

  // Top Performing Campaigns (by Read/Reply Rate)
  const topCampaigns = useMemo(() => {
    return [...allCampaigns]
      .filter(c => c.sentCount > 0)
      .map(c => {
        const rawReadRate = c.deliveredCount > 0 ? (c.readCount || 0) / c.deliveredCount : 0;
        const readRate = Math.min(rawReadRate, 1);
        const replies = c.replyCount || 0;
        return { ...c, calculatedReadRate: readRate, replies };
      })
      .sort((a, b) => b.calculatedReadRate - a.calculatedReadRate || b.replies - a.replies)
      .slice(0, 5);
  }, [allCampaigns]);

  // Recent Campaigns
  const recentCampaigns = useMemo(() => {
    return [...allCampaigns].slice(0, 4);
  }, [allCampaigns]);

  const hasChartData = useMemo(() => {
    return true;
  }, [performanceData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-transparent font-sans py-[1.5rem]">
      <div className="app-container">

        {/* --- 1. TOP KPI CARDS --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-[1rem] mb-[2rem]">
          <div className="card-premium flex flex-col justify-between !p-[1.25rem]">
            <div className="flex items-center justify-between mb-[0.5rem]">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide leading-tight font-poppins">Campaigns</span>
              <div className="w-[2rem] h-[2rem] rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><FiLayers size={14} /></div>
            </div >
            <div className="text-[1.5rem] text-slate-800 font-poppins font-semibold">{totalCampaigns}</div>
          </div>
          <div className="card-premium flex flex-col justify-between !p-[1.25rem]">
            <div className="flex items-center justify-between mb-[0.5rem]">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide leading-tight font-poppins">Templates</span>
              <div className="w-[2rem] h-[2rem] rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><FiMessageSquare size={14} /></div>
            </div>
            <div className="text-[1.5rem] text-emerald-600 font-poppins font-semibold">{approvedTemplates}</div>
          </div>
          <div className="card-premium flex flex-col justify-between !p-[1.25rem]">
            <div className="flex items-center justify-between mb-[0.5rem]">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide leading-tight font-poppins">Contacts</span>
              <div className="w-[2rem] h-[2rem] rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><FiUsers size={14} /></div>
            </div>
            <div className="text-[1.5rem] text-slate-800 font-poppins font-semibold">{activeContacts}</div>
          </div>
          <div className="card-premium flex flex-col justify-between !p-[1.25rem]">
            <div className="flex items-center justify-between mb-[0.5rem]">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide leading-tight font-poppins">Delivered</span>
              <div className="w-[2rem] h-[2rem] rounded-full bg-teal-50 text-teal-600 flex items-center justify-center shrink-0"><FiActivity size={14} /></div>
            </div>
            <div className="text-[1.5rem] text-slate-800 font-poppins font-semibold">{deliveryRate}%</div>
          </div>
          <div className="card-premium flex flex-col justify-between !p-[1.25rem]">
            <div className="flex items-center justify-between mb-[0.5rem]">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide leading-tight font-poppins">Read Rate</span>
              <div className="w-[2rem] h-[2rem] rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><FiPieChart size={14} /></div>
            </div>
            <div className="text-[1.5rem] text-indigo-600 font-poppins font-semibold">{readRate}%</div>
          </div>
          <div className="card-premium flex flex-col justify-between !p-[1.25rem]">
            <div className="flex items-center justify-between mb-[0.5rem]">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide leading-tight font-poppins">Reply Rate</span>
              <div className="w-[2rem] h-[2rem] rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0"><FiMessageCircle size={14} /></div>
            </div>
            <div className="text-[1.5rem] text-orange-600 font-poppins font-semibold">{replyRate}%</div>
          </div>
        </div>

        {/* --- MAIN GRID LAYOUT --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[2rem] mb-[2rem]">

          {/* LEFT COLUMN */}
          <div className="col-span-1 lg:col-span-8 flex flex-col gap-[2rem]">
            {/* 9. MESSAGE PERFORMANCE GRAPH */}
            <div className="card-premium">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[1rem] mb-[2rem]">
                <div>
                  <h3 className="text-[1.125rem] font-semibold text-slate-800 flex items-center gap-[0.5rem] font-poppins">
                    <FiBarChart2 className="text-indigo-500" /> Engagement Overview
                  </h3>
                  <div className="flex items-center gap-[1.25rem] mt-[0.5rem]">
                    <div className="flex items-center gap-[0.375rem]"><div className="w-[0.625rem] h-[0.625rem] rounded-full bg-slate-300"></div><span className="text-[0.625rem] font-bold text-slate-500 uppercase">Sent</span></div>
                    <div className="flex items-center gap-[0.375rem]"><div className="w-[0.625rem] h-[0.625rem] rounded-full bg-emerald-400"></div><span className="text-[0.625rem] font-bold text-slate-500 uppercase">Delivered</span></div>
                    <div className="flex items-center gap-[0.375rem]"><div className="w-[0.625rem] h-[0.625rem] rounded-full bg-indigo-500"></div><span className="text-[0.625rem] font-bold text-slate-500 uppercase">Read</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-[0.75rem]">
                  <div className="flex bg-slate-100 p-[0.25rem] rounded-xl">
                    {["Area", "Bar"].map((type) => (
                      <button key={type} onClick={() => setChartType(type)}
                        className={`px-[0.75rem] py-[0.375rem] text-[0.625rem] font-bold rounded-lg transition-all ${chartType === type ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className="flex bg-slate-100 p-[0.25rem] rounded-xl">
                    {["Day", "Week", "Month"].map((period) => (
                      <button key={period} onClick={() => { setTimeFilter(period); fetchData(period); }}
                        className={`px-[0.75rem] py-[0.375rem] text-[0.625rem] font-bold rounded-lg transition-all ${timeFilter === period ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-full h-[320px] relative">
                {!hasChartData && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 rounded-xl backdrop-blur-sm">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-400 mb-4 animate-bounce"><FiTrendingUp size={24} /></div>
                    <p className="text-slate-800 font-bold">No Data Available Yet</p>
                    <p className="text-xs text-slate-400 mt-1">Start a campaign to see insights</p>
                  </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "Bar" ? (
                    <BarChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="sent" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar dataKey="delivered" fill="#34d399" radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar dataKey="read" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={16} />
                    </BarChart>
                  ) : (
                    <AreaChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRead" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2} /><stop offset="95%" stopColor="#4F46E5" stopOpacity={0} /></linearGradient>
                        <linearGradient id="colorDeliv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.2} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="sent" stroke="#cbd5e1" fill="none" strokeWidth={2} />
                      <Area type="monotone" dataKey="delivered" stroke="#34d399" fill="url(#colorDeliv)" strokeWidth={2} />
                      <Area type="monotone" dataKey="read" stroke="#4F46E5" fill="url(#colorRead)" strokeWidth={3} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. CAMPAIGN FUNNEL & 7. TOP PERFORMING */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[2rem]">

              {/* Funnel */}
              <div className="card-premium relative overflow-hidden group">
                <div className="flex items-center justify-between mb-[1.5rem] gap-[0.75rem]">
                  <div>
                    <h3 className="text-[0.875rem] font-semibold text-slate-800 uppercase tracking-widest font-poppins">Audience Funnel</h3>
                    <p className="text-[0.6875rem] text-slate-500 mt-[0.5rem]">Latest message funnel performance for the selected period.</p>
                  </div>
                  <span className="text-[0.625rem] font-semibold uppercase tracking-widest text-slate-400 bg-slate-100 px-[0.75rem] py-[0.25rem] rounded-full">Last 7 days</span>
                </div>
                <div className="space-y-[1.25rem]">
                  <div className="relative">
                    <div className="flex justify-between text-[0.6875rem] font-medium mb-[0.25rem]"><span className="text-slate-500">Sent</span><span className="text-slate-800">{f_sent_d.toLocaleString()}</span></div>
                    <div className="w-full h-[0.75rem] bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-300 transition-all duration-1000" style={{ width: '100%' }}></div></div>
                  </div>
                  <div className="relative">
                    <div className="flex justify-between text-[0.6875rem] font-medium mb-[0.25rem]"><span className="text-emerald-700">Delivered ({f_deliv_pct}%)</span><span className="text-slate-800">{f_deliv_d.toLocaleString()}</span></div>
                    <div className="w-full h-[0.75rem] bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-400 transition-all duration-1000" style={{ width: `${f_deliv_pct}%` }}></div></div>
                  </div>
                  <div className="relative">
                    <div className="flex justify-between text-[0.6875rem] font-medium mb-[0.25rem]"><span className="text-indigo-700">Read ({f_read_pct}%)</span><span className="text-slate-800">{f_read_d.toLocaleString()}</span></div>
                    <div className="w-full h-[0.75rem] bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${f_read_pct}%` }}></div></div>
                  </div>
                  <div className="relative">
                    <div className="flex justify-between text-[0.6875rem] font-medium mb-[0.25rem]"><span className="text-orange-600">Replied ({f_reply_pct}%)</span><span className="text-slate-800">{f_reply_d.toLocaleString()}</span></div>
                    <div className="w-full h-[0.75rem] bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-orange-400 transition-all duration-1000" style={{ width: `${f_reply_pct}%` }}></div></div>
                  </div>
                </div>
              </div>

              {/* Top Performing */}
              <div className="card-premium">
                <h3 className="text-[0.875rem] font-semibold text-slate-800 uppercase tracking-widest mb-[1.25rem] font-poppins">Top Performers</h3>
                <div className="space-y-[1rem]">
                  {topCampaigns.length > 0 ? topCampaigns.map((camp, idx) => (
                    <div key={idx} className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 p-[0.5rem] -mx-[0.5rem] rounded-xl transition-all" onClick={() => navigate('/campaigns')}>
                      <div className="flex items-center gap-[0.75rem] overflow-hidden">
                        <div className="w-[2rem] h-[2rem] rounded-full bg-indigo-50 text-indigo-500 font-bold flex items-center justify-center text-[0.75rem] shrink-0">{idx + 1}</div>
                        <div className="truncate">
                          <p className="text-[0.8125rem] font-bold text-slate-800 truncate">{camp.name || 'Untitled'}</p>
                          <p className="text-[0.625rem] text-slate-400 uppercase font-semibold">Replies: {camp.replies}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-[0.5rem]">
                        <p className="text-[0.8125rem] font-black text-indigo-600">{Math.min(camp.calculatedReadRate * 100, 100).toFixed(1)}%</p>
                        <p className="text-[0.5625rem] text-slate-400 uppercase tracking-widest font-bold">Read Rate</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-[0.75rem] text-slate-400 italic">Not enough data to rank campaigns.</p>
                  )}
                </div>
              </div>

            </div>

            {/* 4. RECENT CAMPAIGNS & TEMPLATE STATUS ROW */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-[2rem]">

              {/* RECENT CAMPAIGNS - LEFT (8/12) */}
              <div className="xl:col-span-8 bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-[1.5rem] border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-[0.875rem] font-semibold text-slate-800 uppercase tracking-widest font-poppins">Recent Campaigns</h3>
                  <button onClick={() => navigate('/campaigns')} className="text-[0.75rem] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-[0.25rem] transition-colors">View All <FiArrowRight /></button>
                </div>
                <div className="p-[1rem] flex flex-col gap-[0.5rem]">
                  {recentCampaigns.length > 0 ? recentCampaigns.map((camp) => {
                    const s = camp.sentCount || 0;
                    const d = camp.deliveredCount || 0;
                    const pct = s > 0 ? Math.round((d / s) * 100) : 0;
                    return (
                      <div key={camp._id} className="flex items-center justify-between p-[1rem] bg-white hover:bg-slate-50 border border-slate-100 hover:border-indigo-200 rounded-2xl transition-all cursor-pointer group" onClick={() => navigate('/campaigns')}>
                        <div className="flex items-center gap-[1rem]">
                          <div className="w-[2.5rem] h-[2.5rem] rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 shrink-0 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                            <FiSend size={16} className={camp.status === 'running' ? 'animate-pulse' : ''} />
                          </div>
                          <div>
                            <p className="font-bold text-[0.875rem] text-slate-800 group-hover:text-indigo-600 transition-colors">{camp.name || 'Untitled'}</p>
                            <div className="flex items-center gap-[0.5rem] mt-[0.125rem]">
                              <span className="text-[0.625rem] text-slate-400 font-semibold">{new Date(camp.createdAt).toLocaleDateString()}</span>
                              <span className={`px-[0.375rem] py-[0.125rem] rounded text-[0.5rem] font-black uppercase tracking-widest
                                ${camp.status === 'completed' ? 'bg-indigo-100 text-indigo-700' :
                                  camp.status === 'failed' ? 'bg-red-100 text-red-700' :
                                    camp.status === 'running' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                {camp.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-[1.5rem]">
                          <div className="hidden sm:block text-right w-[6rem]">
                            <p className="text-[0.5625rem] font-bold text-slate-400 uppercase tracking-wider mb-[0.375rem] flex justify-between">
                              <span className="text-slate-500">Delivered</span>
                              <span className="text-indigo-600 flex items-center gap-[0.375rem] justify-end">
                                <span className="w-[0.375rem] h-[0.375rem] rounded-full bg-indigo-500"></span>
                                {d} / {camp.total || s}
                                <span className="text-slate-400 font-medium">({pct}%)</span>
                              </span>
                            </p>
                            <div className="w-full h-[0.375rem] bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                          <div className="flex items-center gap-[0.25rem]">
                            {(camp.status === 'draft' || camp.status === 'paused') && (
                              <button
                                onClick={(e) => handleRunCampaign(e, camp._id)}
                                className="w-[2rem] h-[2rem] rounded-full text-emerald-500 hover:bg-emerald-50 transition-colors flex items-center justify-center group/play"
                                title="Run Campaign"
                              >
                                <FiPlay size={14} className="group-hover/play:scale-110 transition-transform" />
                              </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); navigate(`/campaigns/edit/${camp._id}`); }} className="w-[2rem] h-[2rem] rounded-full text-slate-400 hover:bg-indigo-50 hover:text-indigo-500 transition-colors flex items-center justify-center">
                              <FiEdit2 size={14} />
                            </button>
                            <button onClick={(e) => handleDuplicateCampaign(e, camp._id)} className="w-[2rem] h-[2rem] rounded-full text-slate-400 hover:bg-indigo-50 hover:text-indigo-500 transition-colors flex items-center justify-center">
                              <FiRefreshCw size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-[2.5rem]"><p className="text-[0.875rem] text-slate-400">No campaigns launched yet.</p></div>
                  )}
                </div>
              </div>

              {/* TEMPLATE STATUS - RIGHT (4/12) */}
              <div className="xl:col-span-4 card-premium flex flex-col">
                <div className="flex items-center justify-between mb-[1.5rem]">
                  <h3 className="text-[0.875rem] font-semibold text-slate-800 uppercase tracking-widest font-poppins">Template Status</h3>
                  <button onClick={() => navigate('/templates')} className="text-[0.625rem] font-bold text-blue-500 hover:text-blue-700 uppercase tracking-wider">Manage</button>
                </div>

                <div className="space-y-[1.5rem]">
                  {/* WhatsApp Templates Breakdown */}
                  <div>
                    <label className="text-[0.625rem] font-bold text-slate-400 uppercase tracking-[0.15em] mb-[1rem] block">WhatsApp Ecosystem</label>
                    <div className="space-y-[0.75rem]">
                      <div className="flex items-center justify-between p-[0.75rem] rounded-xl bg-emerald-50/50 border border-emerald-100/50">
                        <div className="flex items-center gap-[0.625rem]">
                          <div className="w-[0.5rem] h-[0.5rem] rounded-full bg-emerald-500"></div>
                          <span className="text-[0.8125rem] font-semibold text-slate-700 font-poppins">Approved</span>
                        </div>
                        <span className="text-[0.875rem] font-bold text-emerald-700 font-poppins">{dashboardData?.templates?.approved || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-[0.75rem] rounded-xl bg-amber-50/50 border border-amber-100/50">
                        <div className="flex items-center gap-[0.625rem]">
                          <div className="w-[0.5rem] h-[0.5rem] rounded-full bg-amber-500"></div>
                          <span className="text-[0.8125rem] font-semibold text-slate-700 font-poppins">Pending</span>
                        </div>
                        <span className="text-[0.875rem] font-bold text-amber-700 font-poppins">{dashboardData?.templates?.pending || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-[0.75rem] rounded-xl bg-red-50/50 border border-red-100/50">
                        <div className="flex items-center gap-[0.625rem]">
                          <div className="w-[0.5rem] h-[0.5rem] rounded-full bg-red-500"></div>
                          <span className="text-[0.8125rem] font-semibold text-slate-700 font-poppins">Rejected</span>
                        </div>
                        <span className="text-[0.875rem] font-bold text-red-700 font-poppins">{dashboardData?.templates?.rejected || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* System Templates Breakdown */}
                  <div className="pt-[1rem] border-t border-slate-100">
                    <label className="text-[0.625rem] font-bold text-slate-400 uppercase tracking-[0.15em] mb-[1rem] block">Internal System</label>
                    <div className="space-y-[0.75rem]">
                      <div className="flex items-center justify-between p-[0.75rem] rounded-xl bg-indigo-50/50 border border-indigo-100/50 group hover:border-indigo-300 transition-colors" onClick={() => navigate('/templates/system')} style={{ cursor: 'pointer' }}>
                        <div className="flex items-center gap-[0.625rem]">
                          <div className="w-[0.5rem] h-[0.5rem] rounded-full bg-indigo-500"></div>
                          <span className="text-[0.8125rem] font-semibold text-slate-700 font-poppins">Text Assets</span>
                        </div>
                        <span className="text-[0.875rem] font-bold text-indigo-700 font-poppins">{dashboardData?.templates?.system?.text || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-[0.75rem] rounded-xl bg-sky-50/50 border border-sky-100/50 group hover:border-sky-300 transition-colors" onClick={() => navigate('/templates/system')} style={{ cursor: 'pointer' }}>
                        <div className="flex items-center gap-[0.625rem]">
                          <div className="w-[0.5rem] h-[0.5rem] rounded-full bg-sky-500"></div>
                          <span className="text-[0.8125rem] font-semibold text-slate-700 font-poppins">Media Assets</span>
                        </div>
                        <span className="text-[0.875rem] font-bold text-sky-700 font-poppins">{dashboardData?.templates?.system?.media || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>


          {/* RIGHT COLUMN - ENHANCED SPACING */}
          <div className="col-span-1 lg:col-span-4 flex flex-col gap-[2.5rem] h-full">

            {/* 6. ALERTS & ISSUES (Removed by request) */}
            {/* 11. ACTIVE SYNC */}
            <div className="card-premium">
              <h3 className="text-[0.875rem] font-semibold text-slate-800 uppercase tracking-widest mb-[1.25rem] font-poppins">Active Sync</h3>
              <div className="space-y-[1rem]">

                <div className="flex flex-col p-[1rem] bg-slate-50 border border-slate-100 rounded-2xl group transition-all hover:bg-white hover:border-emerald-200 hover:shadow-sm cursor-pointer" onClick={() => navigate('/settings?service=whatsapp')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[0.75rem]">
                      <div className="w-[2rem] h-[2rem] rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <FiGlobe size={14} />
                      </div>
                      <div>
                        <p className="text-[0.75rem] font-semibold text-slate-800">WhatsApp Business</p>
                        <p className="text-[0.625rem] text-slate-500">{integrationData?.phoneNumber || 'Connect WhatsApp Integration'}</p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className={`text-[0.5625rem] font-semibold uppercase tracking-widest px-[0.5rem] py-[0.375rem] rounded-full ${integrationData?.isConnected ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {integrationData?.isConnected ? 'Active' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col p-[1rem] bg-slate-50 border border-slate-100 rounded-2xl group transition-all hover:bg-white hover:border-[#7F54B3]/30 hover:shadow-sm cursor-pointer" onClick={() => navigate('/settings?service=woocommerce')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[0.75rem]">
                      <div className="w-[2rem] h-[2rem] rounded-full bg-[#7F54B3]/10 text-[#7F54B3] flex items-center justify-center shrink-0">
                        <FiShoppingCart size={14} />
                      </div>
                      <div>
                        <p className="text-[0.75rem] font-semibold text-slate-800">WooCommerce</p>
                        <p className="text-[0.625rem] text-slate-500">Click to open WooCommerce settings</p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className={`text-[0.5625rem] font-semibold uppercase tracking-widest px-[0.5rem] py-[0.375rem] rounded-full ${woocommerceIntegration?.isConnected ? 'bg-[#7F54B3]/10 text-[#7F54B3] border border-[#7F54B3]/20' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {woocommerceIntegration?.isConnected ? 'Active' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  {woocommerceIntegration?.isConnected && (
                    <div className="mt-[1rem] pt-[1rem] border-t border-slate-100 grid grid-cols-2 gap-[1rem]">
                      <div>
                        <p className="text-[0.625rem] font-medium text-slate-400 uppercase tracking-widest mb-[0.125rem]">Total Orders</p>
                        <p className="text-[0.9375rem] font-semibold text-slate-800">{woocommerceIntegration.stats.orders}</p>
                      </div>
                      <div>
                        <p className="text-[0.625rem] font-medium text-[#7F54B3] uppercase tracking-widest mb-[0.125rem]">Carts Recovered</p>
                        <p className="text-[0.9375rem] font-semibold text-[#7F54B3]">{woocommerceIntegration.stats.abandonedCarts}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col p-[1rem] bg-slate-50 border border-slate-100 rounded-2xl group transition-all hover:bg-white hover:border-[#95BF47]/30 hover:shadow-sm cursor-pointer" onClick={() => navigate('/settings?service=shopify')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[0.75rem]">
                      <div className="w-[2rem] h-[2rem] rounded-full bg-[#95BF47]/10 text-[#95BF47] flex items-center justify-center shrink-0">
                        <FiShoppingBag size={14} />
                      </div>
                      <div>
                        <p className="text-[0.75rem] font-semibold text-slate-800">Shopify Marketplace</p>
                        <p className="text-[0.625rem] text-slate-500">Click to open Shopify settings</p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className={`text-[0.5625rem] font-semibold uppercase tracking-widest px-[0.5rem] py-[0.375rem] rounded-full ${shopifyIntegration?.isConnected ? 'bg-[#95BF47]/10 text-[#95BF47] border border-[#95BF47]/20' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {shopifyIntegration?.isConnected ? 'Active' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  {shopifyIntegration?.isConnected && (
                    <div className="mt-[1rem] pt-[1rem] border-t border-slate-100 grid grid-cols-2 gap-[1rem]">
                      <div>
                        <p className="text-[0.625rem] font-medium text-slate-400 uppercase tracking-widest mb-[0.125rem]">Total Orders</p>
                        <p className="text-[0.9375rem] font-semibold text-slate-800">{shopifyIntegration.stats.orders}</p>
                      </div>
                      <div>
                        <p className="text-[0.625rem] font-medium text-[#95BF47] uppercase tracking-widest mb-[0.125rem]">Carts Recovered</p>
                        <p className="text-[0.9375rem] font-semibold text-[#95BF47]">{shopifyIntegration.stats.abandonedCheckouts}</p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* 2. REAL-TIME ACTIVITY FEED (LIVE STREAM) */}
            <div className="card-premium flex flex-col h-[22rem]">
              <div className="flex items-center justify-between mb-[1.5rem] shrink-0">
                <h3 className="text-[0.875rem] font-semibold text-slate-800 uppercase tracking-widest flex items-center gap-[0.5rem] font-poppins">
                  <FiActivity className="text-emerald-500" /> Live Stream
                </h3>
                <div className="flex items-center gap-[0.375rem] px-[0.5rem] py-[0.25rem] bg-emerald-50 rounded-full border border-emerald-100 shadow-inner">
                  <div className="w-[0.375rem] h-[0.375rem] bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-[0.5625rem] font-black text-emerald-700 uppercase tracking-wider">Syncing</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-[0.5rem] space-y-[1rem] custom-scrollbar">
                {recentActivity.length > 0 ? recentActivity.map((act, idx) => (
                  <div key={idx} className="relative pl-[1.5rem] pb-[1rem] border-l border-slate-100 last:border-0 last:pb-0 group">
                    <div className={`absolute -left-[0.4375rem] top-[0.25rem] w-[0.875rem] h-[0.875rem] rounded-full border-[3px] border-white shadow-sm
                        ${act.type === 'reply' ? 'bg-orange-500' :
                        act.status === 'read' ? 'bg-indigo-500' :
                          act.status === 'delivered' ? 'bg-emerald-400' :
                            act.status === 'failed' ? 'bg-red-500' : 'bg-slate-300'}`}
                    />
                    <p className="text-[0.875rem] font-semibold text-slate-700 leading-tight mb-[0.25rem] group-hover:text-indigo-600 transition-colors">{act.title}</p>
                    <p className="text-[0.625rem] text-slate-400 font-bold uppercase tracking-widest">{new Date(act.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                  </div>
                )) : (
                  <div className="text-center mt-[2.5rem]"><p className="text-[0.6875rem] font-bold text-slate-400 uppercase tracking-widest">Waiting for events...</p></div>
                )}
              </div>
            </div>

            {/* CONTROL PANEL */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-[1.5rem] p-[1.5rem] relative overflow-hidden shadow-lg shadow-indigo-900/10 w-full flex flex-col">
              <div className="absolute top-0 right-0 w-[12rem] h-[12rem] bg-white/10 rounded-full blur-3xl -mt-[4rem] -mr-[4rem] pointer-events-none"></div>
              <h3 className="text-[0.875rem] font-semibold text-white uppercase tracking-widest mb-[1.25rem] relative z-10 font-poppins">Control Panel</h3>
              <div className="grid grid-cols-2 gap-[1rem] relative z-10 w-full">
                <button onClick={() => navigate('/templates/create')} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl p-[1rem] text-left transition-all hover:-translate-y-0.5 group flex flex-col justify-between">
                  <div>
                    <div className="w-[2rem] h-[2rem] rounded-xl bg-white/20 text-white flex items-center justify-center mb-[0.75rem]"><FiLayers size={14} /></div>
                    <p className="text-[0.875rem] font-bold text-white mb-[0.125rem] leading-tight font-poppins">Create Template</p>
                    <p className="text-[0.5625rem] text-indigo-100 uppercase tracking-wider font-semibold opacity-70">Start fresh</p>
                  </div>
                </button>
                <button onClick={() => navigate('/settings?service=whatsapp')} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl p-[1rem] text-left transition-all hover:-translate-y-0.5 group flex flex-col justify-between">
                  <div>
                    <div className="w-[2rem] h-[2rem] rounded-xl bg-white/20 text-white flex items-center justify-center mb-[0.75rem]"><FiGlobe size={14} /></div>
                    <p className="text-[0.875rem] font-bold text-white mb-[0.125rem] leading-tight font-poppins">System Connect</p>
                    <p className="text-[0.5625rem] text-indigo-100 uppercase tracking-wider font-semibold opacity-70">Integrations</p>
                  </div>
                </button>
                <button onClick={() => navigate('/templates')} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl p-[1rem] text-left transition-all hover:-translate-y-0.5 group col-span-2 flex items-center justify-between">
                  <div className="flex items-center gap-[1rem]">
                    <div className="w-[2rem] h-[2rem] rounded-xl bg-white/20 text-white flex items-center justify-center"><FiLayers size={14} /></div>
                    <div>
                      <p className="text-[0.875rem] font-bold text-white leading-tight font-poppins">Template Library</p>
                      <p className="text-[0.5625rem] text-indigo-100 uppercase tracking-wider font-semibold opacity-70">View all saved assets</p>
                    </div>
                  </div>
                  <div className="w-[2rem] h-[2rem] rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-indigo-600 transition-all">
                    <FiArrowRight size={14} />
                  </div>
                </button>
              </div>
            </div>

            {/* FLOW STATS */}
            <div className="card-premium">
              <div className="flex items-center justify-between mb-[1.25rem]">
                <h3 className="text-[0.875rem] font-semibold text-slate-800 uppercase tracking-widest font-poppins">Flow Stats</h3>
                <button onClick={() => navigate('/automation/flows/new')} className="text-[0.625rem] font-bold text-blue-500 hover:text-blue-700 uppercase tracking-wider flex items-center gap-1"><FiPlay size={10} /> Create Flow</button>
              </div>
              <div className="grid grid-cols-2 gap-[1rem]">
                <div className="bg-indigo-50/50 p-[1rem] rounded-2xl border border-indigo-100/50">
                  <p className="text-[0.625rem] font-bold text-slate-400 uppercase tracking-widest mb-[0.25rem]">Total Flows</p>
                  <p className="text-[1.25rem] font-bold text-indigo-600">{flows.length}</p>
                </div>
                <div className="bg-emerald-50/50 p-[1rem] rounded-2xl border border-emerald-100/50">
                  <p className="text-[0.625rem] font-bold text-slate-400 uppercase tracking-widest mb-[0.25rem]">Active</p>
                  <p className="text-[1.25rem] font-bold text-emerald-600">{flows.filter(f => f.status === 'active').length}</p>
                </div>
              </div>
            </div>




          </div>
        </div>

      </div>
    </div>
  );
}