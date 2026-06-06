import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';
import {
  ShoppingCart,
  TrendingUp,
  RefreshCw,
  Search,
  CheckCircle,
  Clock,
  Eye,
  X,
  Phone,
  ArrowRight,
  Send,
  Zap,
  Mail,
  Tag,
  Users,
  Trash2
} from 'lucide-react';
import api from '../api/api';
import DensitySelector from '../components/UI/DensitySelector';

export default function AbandonedCarts() {
  const [carts, setCarts] = useState([]);
  const [stats, setStats] = useState({
    totalCarts: 0,
    todayCarts: 0,
    whatsappSentCarts: 0,
    recoveryRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();

  const fetchCarts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: rowsPerPage,
        ...(searchTerm && { search: searchTerm })
      });

      const response = await api.get(`/woocommerce/abandoned-carts?${params}`);
      if (response.data.success) {
        setCarts(response.data.data);
        setTotalPages(response.data.pagination.pages || 1);
      }
    } catch (error) {
      console.error('Error fetching abandoned carts:', error);
      toast.error('Failed to load abandoned carts');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/woocommerce/abandoned-carts/stats');
      if (response.data.success) {
        const s = response.data.data;
        setStats({
          totalCarts: s.totalCarts || 0,
          todayCarts: 0,
          whatsappSentCarts: 0,
          recoveryRate: s.totalCarts > 0 ? Math.round((s.convertedCarts / s.totalCarts) * 100) : 0
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Initial Trigger on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Trigger on-demand check when page opens
        await api.post('/abandoned-carts/trigger-recovery');
      } catch (e) {
        console.warn("Auto-recovery check skipped:", e.message);
      } finally {
        fetchCarts();
        fetchStats();
      }
    };
    init();
  }, []); // Only on mount

  useEffect(() => {
    fetchCarts();
    fetchStats();
  }, [currentPage, searchTerm, rowsPerPage]);

  const handleDelete = async (cartId) => {
    if (!window.confirm('Are you sure you want to delete this abandoned cart?')) return;
    try {
      const res = await api.delete(`/woocommerce/abandoned-carts/${cartId}`);
      if (res.data.success) {
        toast.success("Cart deleted successfully");
        fetchCarts();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to delete cart:', err);
      toast.error('Failed to delete cart');
    }
  };

  const handleRetry = async (cartId) => {
    try {
      // Optimistic Update
      setCarts(prev => prev.map(c =>
        c._id === cartId ? { ...c, whatsapp_sent: true } : c
      ));

      setActionLoading(cartId);
      await api.post(`/woocommerce/abandoned-carts/${cartId}/retry`);
      toast.success("Recovery message triggered!");
    } catch (err) {
      console.error("Retry failed", err);
      toast.error("Failed to trigger recovery.");
      // Could revert optimistic state here if needed
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden font-poppins text-slate-900">
      {/* Header & Controls */}
      <div className="px-6 pt-6 pb-4 shrink-0 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative group flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Search by Cart ID or Customer name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-11 pr-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-medium text-slate-700 shadow-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <DensitySelector
              value={rowsPerPage}
              onChange={(val) => {
                setRowsPerPage(val);
                setCurrentPage(1);
              }}
              options={[
                { label: "5 Rows", value: 5 },
                { label: "10 Rows", value: 10 },
                { label: "15 Rows", value: 15 },
                { label: "25 Rows", value: 25 },
                { label: "50 Rows", value: 50 }
              ]}
              label="Density:"
            />
            <button 
              onClick={() => { fetchCarts(); fetchStats(); }}
              className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 shadow-sm transition-all active:scale-95"
            >
              <RefreshCw className={cn("w-4.5 h-4.5", loading && "animate-spin")} />
            </button>
            <div className="h-8 w-[1px] bg-slate-200 mx-1" />
            <div className="flex items-center gap-2 px-4 h-10 bg-[#D1FAE5] text-[#047857] rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm border border-[#A7F3D0] relative group/tip cursor-help">
              <Zap className="w-3.5 h-3.5 animate-pulse" />
              Auto-Recovery Active
              <div className="absolute top-full right-0 mt-3 w-64 p-4 bg-slate-900 text-white text-[10px] font-medium leading-relaxed rounded-2xl opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-50 shadow-2xl normal-case">
                <p className="font-bold border-b border-white/10 pb-2 mb-2 uppercase tracking-widest text-emerald-400">Recovery Logic</p>
                System automatically sends a WhatsApp template to customers who abandon their checkout after 30 minutes of inactivity.
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Abandoned', value: stats.totalCarts, icon: ShoppingCart, color: 'blue' },
            { label: 'Today Records', value: stats.todayCarts, icon: Clock, color: 'amber' },
            { label: 'Messages Sent', value: stats.whatsappSentCarts, icon: Send, color: 'violet' },
            { label: 'Recovery Rate', value: `${stats.recoveryRate}%`, icon: TrendingUp, color: 'emerald' }
          ].map((stat, i) => (
            <div key={i} className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm group hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <p className="text-xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
                </div>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110",
                  stat.color === 'blue' && "bg-gradient-to-br from-blue-600 to-blue-500 shadow-blue-500/20",
                  stat.color === 'amber' && "bg-gradient-to-br from-amber-600 to-amber-500 shadow-amber-500/20",
                  stat.color === 'violet' && "bg-gradient-to-br from-violet-600 to-violet-500 shadow-violet-500/20",
                  stat.color === 'emerald' && "bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-emerald-500/20",
                )}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-[13px] text-slate-600">
              <thead className="bg-slate-100/50 text-slate-800 font-bold border-b border-slate-200 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">Cart Identity</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">Customer Profile</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">Potential Value</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">WhatsApp Delivery</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-8">
                        <div className="h-4 bg-slate-50 rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : carts.length > 0 ? (
                  carts.map((cart) => (
                    <tr key={cart._id} className="hover:bg-blue-50/20 transition-all duration-300 group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 text-[13px] group-hover:text-blue-700">#{cart.cart_id?.slice(-6).toUpperCase() || 'CART-ID'}</span>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1">
                            {new Date(cart.abandoned_at || cart.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-800 text-[13px] group-hover:text-blue-600 transition-colors truncate">{cart.customer_name || 'Anonymous Guest'}</span>
                          <div className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400 uppercase tracking-widest mt-1">
                            <Phone className="w-3 h-3 text-slate-300" /> {cart.customer_phone || 'No Phone Linked'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900 text-[13px] tracking-tight">
                          <span className="text-[10px] text-slate-400 mr-1 uppercase tracking-widest font-semibold">{cart.currency || '$'}</span>
                          {parseFloat(cart.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {cart.whatsapp_sent ? (
                          <div className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50/50 px-2.5 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-widest border border-blue-100/50 shadow-sm">
                            <CheckCircle size={12} strokeWidth={2.5} /> Recovery Sent
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50/50 px-2.5 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-widest border border-amber-100/50 shadow-sm animate-pulse">
                            <Clock size={12} strokeWidth={2.5} /> Awaiting Trigger
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <button
                            onClick={() => navigate(`/abandoned-carts/${cart._id}`)}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-transparent hover:border-indigo-100 shadow-sm hover:shadow-md"
                            title="Inspect Cart"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            disabled={actionLoading === cart._id}
                            onClick={() => handleRetry(cart._id)}
                            className={cn(
                              "h-8 px-4 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-all active:scale-95 shadow-sm border",
                              cart.whatsapp_sent 
                                ? "text-slate-400 bg-white border-slate-200 hover:bg-slate-50" 
                                : "text-white bg-blue-600 border-blue-600 hover:bg-blue-700 shadow-blue-500/10"
                            )}
                          >
                            {cart.whatsapp_sent ? 'Resend' : 'Recover'}
                          </button>
                          <button
                            onClick={() => handleDelete(cart._id)}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 shadow-sm hover:shadow-md"
                            title="Purge Record"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-soft">
                          <ShoppingCart className="w-8 h-8 text-slate-300" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[13px] font-semibold text-slate-500 uppercase tracking-widest">No abandoned carts detected</p>
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest opacity-80">New records will sync automatically from store.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination - ZEPОFY REGISTRY STYLE */}
          <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Cart Registry • Viewing <span className="text-blue-600 font-bold">{((currentPage - 1) * rowsPerPage) + 1}-{Math.min(currentPage * rowsPerPage, carts.length === rowsPerPage ? stats.totalCarts : ((currentPage - 1) * rowsPerPage) + carts.length)}</span> of <span className="text-slate-600">{stats.totalCarts}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="h-8 px-4 text-[10px] font-semibold uppercase tracking-widest bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all text-slate-600 shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
              >
                Prev
              </button>

              <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-8 h-8 rounded-md text-[11px] font-semibold transition-all ${currentPage === i + 1 ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:text-slate-900"}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="h-8 px-4 text-[10px] font-semibold uppercase tracking-widest bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all text-slate-600 shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
              >
                Next
              </button>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}
