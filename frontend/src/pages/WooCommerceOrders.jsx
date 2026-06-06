import { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Eye,
  Download,
  Phone,
  Send,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import toast from 'react-hot-toast';
import { cn } from '../utils/cn';
import DensitySelector from '../components/UI/DensitySelector';

export default function WooCommerceOrders() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    todayOrders: 0,
    whatsappSentCount: 0,
    pendingOrders: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  // Fetch orders
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: rowsPerPage,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      });
      const response = await api.get(`/woocommerce/orders?${params}`);
      if (response.data.success) {
        setOrders(response.data.data);
        setTotalPages(response.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await api.get('/woocommerce/orders/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try {
      const res = await api.delete(`/woocommerce/orders/${orderId}`);
      if (res.data.success) {
        toast.success("Order deleted successfully");
        fetchOrders();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to delete order:', err);
      toast.error('Failed to delete order');
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [currentPage, searchTerm, statusFilter, rowsPerPage]);

  const getStatusStyles = (status) => {
    const s = status?.toLowerCase();
    if (s === 'completed') return 'bg-blue-100 text-blue-700';
    if (s === 'processing') return 'bg-blue-100 text-blue-700';
    if (s === 'pending') return 'bg-yellow-100 text-yellow-700';
    if (s === 'cancelled' || s === 'failed') return 'bg-red-100 text-red-700';
    if (s === 'refunded') return 'bg-gray-100 text-gray-700';
    return 'bg-gray-100 text-gray-700';
  };

  const exportToCSV = () => {
    if (orders.length === 0) return;
    const headers = ["Order ID", "Customer", "Total", "Status", "Date"];
    const rows = orders.map(o => [
      `#${o.orderId}`,
      o.customerName,
      `${o.currency} ${o.totalAmount}`,
      o.status,
      new Date(o.createdAt).toLocaleDateString()
    ]);

    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `WooCommerce_Orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              placeholder="Search by Order ID or Customer name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-11 pr-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-medium text-slate-700 shadow-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <DensitySelector
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { label: "All Status", value: "all" },
                { label: "Pending", value: "pending" },
                { label: "Processing", value: "processing" },
                { label: "Completed", value: "completed" },
                { label: "Cancelled", value: "cancelled" },
                { label: "Refunded", value: "refunded" }
              ]}
              label="Density:"
            />
            
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
              onClick={() => { fetchOrders(); fetchStats(); }}
              className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 shadow-sm transition-all active:scale-95"
            >
              <RefreshCw className={cn("w-4.5 h-4.5", loading && "animate-spin")} />
            </button>
            <button 
              onClick={exportToCSV}
              className="h-10 px-6 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10 active:scale-95 flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Orders', value: stats.totalOrders, icon: Package, color: 'blue' },
            { label: 'Today', value: stats.todayOrders, icon: TrendingUp, color: 'emerald' },
            { label: 'WhatsApp Sent', value: stats.whatsappSentCount, icon: Send, color: 'violet' },
            { label: 'Pending', value: stats.pendingOrders, icon: Clock, color: 'amber' }
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
                  stat.color === 'emerald' && "bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-emerald-500/20",
                  stat.color === 'violet' && "bg-gradient-to-br from-violet-600 to-violet-500 shadow-violet-500/20",
                  stat.color === 'amber' && "bg-gradient-to-br from-amber-600 to-amber-500 shadow-amber-500/20",
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
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">Order Details</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">Customer Info</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">Total Amount</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">Status</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">WhatsApp Status</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-8">
                        <div className="h-4 bg-slate-50 rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : orders.length > 0 ? (
                  orders.map((order) => (
                    <tr key={order.orderId} className="hover:bg-blue-50/20 transition-all duration-300 group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 text-[13px] group-hover:text-blue-700">#{order.orderId}</span>
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">
                            {new Date(order.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-800 text-[13px] group-hover:text-blue-600 transition-colors truncate">{order.customerName}</span>
                          <div className="flex items-center gap-1.5 text-[9px] font-medium text-slate-400 uppercase tracking-widest mt-1">
                            <Phone className="w-3 h-3 text-slate-300" /> {order.customerEmail || 'No Email Linked'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900 text-[13px] tracking-tight">
                          <span className="text-[10px] text-slate-400 mr-1 uppercase tracking-widest font-semibold">{order.currency}</span>
                          {order.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-[0.15em] border inline-flex items-center gap-2 shadow-sm",
                          getStatusStyles(order.status)
                        )}>
                          <div className="w-1 h-1 rounded-full bg-current animate-pulse" />
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {order.whatsapp_sent ? (
                          <div className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50/50 px-2.5 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-widest border border-blue-100/50 shadow-sm">
                            <CheckCircle size={12} strokeWidth={2.5} /> Sent
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-slate-400 bg-slate-50/50 px-2.5 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-widest border border-slate-100/50">
                            <Clock size={12} strokeWidth={2.5} /> Pending
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <button
                            onClick={() => navigate(`/woocommerce/orders/${order.orderId}`)}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100 shadow-sm hover:shadow-md"
                            title="Monitor Order"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(order.orderId)}
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
                    <td colSpan={6} className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm">
                          <ShoppingCart className="w-8 h-8 text-slate-300" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[13px] font-semibold text-slate-500 uppercase tracking-widest">No orders found in registry</p>
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
              Orders Registry • Viewing <span className="text-blue-600 font-bold">{((currentPage - 1) * rowsPerPage) + 1}-{Math.min(currentPage * rowsPerPage, orders.length === rowsPerPage ? stats.totalOrders : ((currentPage - 1) * rowsPerPage) + orders.length)}</span> of <span className="text-slate-600">{stats.totalOrders}</span>
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
