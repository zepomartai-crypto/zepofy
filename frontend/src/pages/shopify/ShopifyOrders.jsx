import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ShoppingBag,
    Package,
    TrendingUp,
    RefreshCw,
    Search,
    Filter,
    CheckCircle,
    Clock,
    Eye,
    Download,
    X,
    User,
    Calendar,
    Tag,
    Phone,
    ExternalLink,
    ShoppingCart,
    Trash2
} from 'lucide-react';
import api from '../../api/api';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import DensitySelector from '../../components/UI/DensitySelector';

export default function ShopifyOrders() {
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
    const navigate = useNavigate();

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: currentPage,
                limit: rowsPerPage,
                ...(searchTerm && { search: searchTerm }),
                ...(statusFilter !== 'all' && { status: statusFilter })
            });

            const response = await api.get(`/shopify/orders?${params}`);
            if (response.data.success) {
                setOrders(response.data.orders);
                setTotalPages(Math.ceil(response.data.orders.length / 15) || 1);
            }
        } catch (err) {
            console.error('Failed to fetch Shopify orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await api.get('/shopify/analytics');
            if (response.data.success) {
                setStats({
                    totalOrders: response.data.stats.totalOrders || 0,
                    todayOrders: 0,
                    whatsappSentCount: 0,
                    pendingOrders: 0
                });
            }
        } catch (e) {
            console.error("Failed to fetch Shopify analytics", e);
        }
    };

    // Initial Sync on mount
    useEffect(() => {
        const syncOnMount = async () => {
            try {
                await api.post('/shopify/sync');
            } catch (e) {
                console.warn("Auto-sync skipped:", e.message);
            } finally {
                fetchOrders();
                fetchStats();
            }
        };
        syncOnMount();
    }, []);

    useEffect(() => {
        fetchOrders();
        fetchStats();
    }, [currentPage, searchTerm, statusFilter, rowsPerPage]);

    const handleDelete = async (orderNumber) => {
        if (!window.confirm('Are you sure you want to delete this Shopify order?')) return;
        try {
            const res = await api.delete(`/shopify/orders/${orderNumber}`);
            if (res.data.success) {
                toast.success("Shopify Order deleted successfully");
                fetchOrders();
                fetchStats();
            }
        } catch (err) {
            console.error('Failed to delete order:', err);
            toast.error('Failed to delete order');
        }
    };

    const getStatusStyles = (status) => {
        const s = status?.toLowerCase();
        if (s === 'paid' || s === 'completed') return 'bg-blue-50 text-blue-700 border-blue-100';
        if (s === 'pending' || s === 'unpaid' || s === 'authorized') return 'bg-amber-50 text-amber-700 border-amber-100';
        if (s === 'processing') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
        if (s === 'refunded' || s === 'voided') return 'bg-slate-50 text-slate-700 border-slate-100';
        return 'bg-red-50 text-red-700 border-red-100';
    };

    const exportToCSV = () => {
        if (orders.length === 0) return;
        const headers = ["Order ID", "Customer", "Total", "Status", "Date"];
        const rows = orders.map(o => [
            `#${o.orderNumber}`,
            o.customerName,
            `${o.currency} ${o.orderTotal}`,
            o.orderStatus,
            new Date(o.createdAt).toLocaleDateString()
        ]);

        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Shopify_Orders_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden font-poppins text-slate-900">
            {/* Header / Filter Bar */}
            <div className="px-6 pt-6 pb-4 shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative flex-1 max-w-md group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search Shopify orders..."
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 h-10 text-sm font-semibold focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none placeholder:text-slate-300"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <DensitySelector
                                value={statusFilter}
                                onChange={(val) => setStatusFilter(val)}
                                options={[
                                    { label: "ALL STATUS", value: "all" },
                                    { label: "PAID", value: "paid" },
                                    { label: "PENDING", value: "pending" },
                                    { label: "REFUNDED", value: "refunded" }
                                ]}
                                label=""
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
                                label=""
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { fetchOrders(); fetchStats(); }}
                            className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl transition-all shadow-sm active:scale-95"
                            title="Refresh Data"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={exportToCSV}
                            className="h-10 px-5 flex items-center gap-2 bg-slate-900 text-white rounded-xl text-[11px] font-semibold uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10 active:scale-95"
                        >
                            <Download size={16} /> EXPORT
                        </button>
                    </div>
                </div>

                {/* Statistics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    {[
                        { label: 'Total Orders', value: stats.totalOrders, icon: Package, color: 'blue' },
                        { label: 'Today', value: stats.todayOrders, icon: TrendingUp, color: 'emerald' },
                        { label: 'WA Sent', value: stats.whatsappSentCount, icon: Send, color: 'violet' },
                        { label: 'Pending', value: stats.pendingOrders, icon: Clock, color: 'amber' }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                    <p className="text-2xl font-semibold text-slate-800 tracking-tight">{stat.value}</p>
                                </div>
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm",
                                    stat.color === 'blue' && "bg-blue-50 text-blue-600",
                                    stat.color === 'emerald' && "bg-emerald-50 text-emerald-600",
                                    stat.color === 'violet' && "bg-violet-50 text-violet-600",
                                    stat.color === 'amber' && "bg-amber-50 text-amber-600"
                                )}>
                                    <stat.icon size={20} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-hidden px-6 pb-4">
                <div className="h-full bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left text-[13px] text-slate-600">
                            <thead className="bg-slate-100/50 text-slate-800 font-bold border-b border-slate-200 sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">Order Detail</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">Customer Info</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">Total Amount</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">Status</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">WhatsApp</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    Array(8).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan="6" className="px-6 py-4">
                                                <div className="h-4 bg-slate-50 rounded-lg w-full" />
                                            </td>
                                        </tr>
                                    ))
                                ) : orders.length > 0 ? (
                                    orders.map((order) => (
                                        <tr key={order._id} className="hover:bg-blue-50/20 transition-all duration-300 group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-900 text-[13px] tracking-tight group-hover:text-blue-700">#{order.orderNumber}</span>
                                                    <span className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-widest">
                                                        {new Date(order.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-semibold text-slate-800 text-[13px] truncate group-hover:text-blue-600 transition-colors">{order.customerName}</span>
                                                    <div className="flex items-center gap-1.5 text-[9px] font-medium text-slate-400 mt-1 uppercase tracking-widest">
                                                        <Phone size={10} className="text-slate-300" /> {order.customerPhone || 'NO PHONE'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-semibold text-slate-900 text-[13px] tracking-tight">
                                                    <span className="text-[10px] text-slate-400 mr-1 uppercase tracking-widest font-semibold">{order.currency}</span>
                                                    {parseFloat(order.orderTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "px-2.5 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-[0.15em] border inline-flex items-center gap-2 shadow-sm",
                                                    getStatusStyles(order.orderStatus)
                                                )}>
                                                    <div className="w-1 h-1 rounded-full bg-current animate-pulse" />
                                                    {order.orderStatus}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {order.whatsapp_sent ? (
                                                    <div className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50/50 px-2.5 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-widest border border-blue-100/50 shadow-sm">
                                                        <CheckCircle size={12} strokeWidth={2.5} /> SENT
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 text-slate-400 bg-slate-50/50 px-2.5 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-widest border border-slate-100/50">
                                                        <Clock size={12} strokeWidth={2.5} /> PENDING
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                    <button
                                                        onClick={() => navigate(`/shopify/orders/${order.orderNumber}`)}
                                                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100 shadow-sm hover:shadow-md"
                                                        title="Monitor Flow"
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                    <a
                                                        href={order.shopUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all border border-transparent hover:border-emerald-100 shadow-sm hover:shadow-md"
                                                        title="External View"
                                                    >
                                                        <ExternalLink size={15} />
                                                    </a>
                                                    <button
                                                        onClick={() => handleDelete(order.orderNumber)}
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
                                        <td colSpan="6" className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm">
                                                    <ShoppingBag className="w-8 h-8 text-slate-300" />
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
                            Shopify Registry • Viewing <span className="text-blue-600 font-bold">{((currentPage - 1) * rowsPerPage) + 1}-{Math.min(currentPage * rowsPerPage, orders.length === rowsPerPage ? stats.totalOrders : ((currentPage - 1) * rowsPerPage) + orders.length)}</span> of <span className="text-slate-600">{stats.totalOrders}</span>
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
