import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ShoppingCart,
    Package,
    TrendingUp,
    RefreshCw,
    Search,
    CheckCircle,
    Clock,
    XCircle,
    Eye,
    X,
    Phone,
    ArrowRight,
    Send,
    MessageCircle,
    ExternalLink,
    Zap,
    Trash2
} from 'lucide-react';
import api from '../../api/api';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';

export default function ShopifyAbandoned() {
    const [checkouts, setCheckouts] = useState([]);
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
    const navigate = useNavigate();
    const [actionLoading, setActionLoading] = useState(false);

    const fetchCheckouts = async () => {
        try {
            setLoading(true);
            const res = await api.get('/shopify/abandoned');
            if (res.data.success) {
                const data = res.data.checkouts;
                setCheckouts(data);

                const totalCount = data.length;
                const sentCount = data.filter(c => c.whatsappSent || c.whatsappStatus === 'sent').length;
                const todayCount = data.filter(c => {
                    const date = new Date(c.abandonedAt);
                    const today = new Date();
                    return date.getDate() === today.getDate() &&
                        date.getMonth() === today.getMonth() &&
                        date.getFullYear() === today.getFullYear();
                }).length;

                setStats({
                    totalCarts: totalCount,
                    todayCarts: todayCount,
                    whatsappSentCarts: sentCount,
                    recoveryRate: totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0
                });

                setTotalPages(Math.ceil(data.length / 20) || 1);
            }
        } catch (err) {
            console.error('Failed to fetch Shopify abandoned checkouts:', err);
            toast.error("Failed to load checkouts");
        } finally {
            setLoading(false);
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
                fetchCheckouts();
            }
        };
        syncOnMount();
    }, []);

    useEffect(() => {
        fetchCheckouts();
    }, [currentPage]);

    const handleRetry = async (checkoutId) => {
        try {
            setCheckouts(prev => prev.map(c =>
                c._id === checkoutId ? { ...c, whatsappSent: true, whatsappStatus: 'sent' } : c
            ));

            setActionLoading(checkoutId);
            const res = await api.post(`/shopify/abandoned-checkouts/${checkoutId}/retry`);
            if (res.data.success) {
                toast.success("Recovery message sent!");
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to send message");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (checkoutId) => {
        if (!window.confirm('Are you sure you want to delete this abandoned checkout?')) return;
        try {
            const res = await api.delete(`/shopify/abandoned-checkouts/${checkoutId}`);
            if (res.data.success) {
                toast.success("Checkout deleted successfully");
                fetchCheckouts();
            }
        } catch (err) {
            console.error('Failed to delete:', err);
            toast.error("Failed to delete checkout");
        }
    };

    const filteredCheckouts = checkouts.filter(item =>
        item.checkoutId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.customerEmail && item.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.customerPhone && item.customerPhone.includes(searchTerm))
    );

    return (
        <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden font-poppins text-slate-900">
            {/* Header / Actions Bar */}
            <div className="px-6 pt-6 pb-4 shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative flex-1 max-w-md group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search checkouts..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 h-10 text-sm font-medium focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none placeholder:text-slate-300"
                            />
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-bold tracking-widest border border-emerald-100/50 shadow-sm animate-pulse uppercase">
                            <Zap size={14} /> SHOPIFY SYNC ACTIVE
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchCheckouts}
                            className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl transition-all shadow-sm active:scale-95"
                            title="Refresh Data"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Statistics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    {[
                        { label: 'Abandoned', value: stats.totalCarts, icon: ShoppingCart, color: 'blue' },
                        { label: 'Today', value: stats.todayCarts, icon: Clock, color: 'amber' },
                        { label: 'Msgs Sent', value: stats.whatsappSentCarts, icon: Send, color: 'violet' },
                        { label: 'Recovery', value: `${stats.recoveryRate}%`, icon: TrendingUp, color: 'emerald' }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm group">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                    <p className="text-2xl font-bold text-slate-800 tracking-tight">{stat.value}</p>
                                </div>
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm font-semibold",
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
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest w-[18%] text-left">Checkout Ref</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest w-[25%] text-left">Customer Profile</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest w-[15%] text-left">Cart Value</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest w-[18%] text-left">Status</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center pr-8 w-[24%]">Operations</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    Array(8).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan="5" className="px-6 py-4">
                                                <div className="h-4 bg-slate-50 rounded-lg w-full" />
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredCheckouts.length > 0 ? (
                                    filteredCheckouts.map((cart) => (
                                        <tr key={cart._id} className="hover:bg-blue-50/20 transition-all duration-300 group">
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-800 text-[13px] tracking-tight group-hover:text-blue-700 uppercase">#{cart.checkoutId?.slice(-6) || 'REF-N/A'}</span>
                                                    <span className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-widest">
                                                        {new Date(cart.abandonedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-semibold text-slate-800 text-[13px] truncate group-hover:text-blue-600 transition-colors uppercase">{cart.customerName || 'Shopify Guest'}</span>
                                                    <div className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400 mt-1 uppercase tracking-widest">
                                                        <Phone size={10} className="text-slate-300" /> {cart.customerPhone || 'NO PHONE'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="font-semibold text-slate-900 text-[13px] tracking-tight">
                                                    <span className="text-[10px] text-slate-400 mr-1 uppercase tracking-widest font-semibold">{cart.currency || 'INR'}</span>
                                                    {parseFloat(cart.cartValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                {cart.whatsappSent || cart.whatsappStatus === 'sent' ? (
                                                    <div className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50/50 px-2.5 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-widest border border-blue-100/50 shadow-sm">
                                                        <CheckCircle size={12} strokeWidth={2.5} /> RECOVERY SENT
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50/50 px-2.5 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-widest border border-amber-100/50 shadow-sm animate-pulse">
                                                        <Clock size={12} strokeWidth={2.5} /> AWAITING TRIGGER
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-5 text-center pr-8">
                                                <div className="flex justify-center items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                    <button
                                                        onClick={() => navigate(`/shopify/checkouts/${cart._id}`)}
                                                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100 shadow-sm hover:shadow-md"
                                                        title="View Details"
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(cart._id)}
                                                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 shadow-sm hover:shadow-md"
                                                        title="Delete Checkout"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                    <button
                                                        disabled={actionLoading === cart._id}
                                                        onClick={() => handleRetry(cart._id)}
                                                        className={cn(
                                                            "h-8 px-4 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-all active:scale-95 shadow-sm border",
                                                            cart.whatsappSent 
                                                                ? "text-slate-500 bg-white border-slate-200 hover:bg-slate-50" 
                                                                : "text-white bg-blue-600 border-blue-600 hover:bg-blue-700 shadow-blue-500/10"
                                                        )}
                                                    >
                                                        {cart.whatsappSent ? 'RESEND' : 'RECOVER'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm mb-4 mx-auto">
                                                    <ShoppingCart className="w-8 h-8 text-slate-300" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[13px] font-semibold text-slate-500 uppercase tracking-widest">No abandoned checkouts</p>
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
                            Shopify Registry • Viewing <span className="text-blue-600 font-bold">{((currentPage - 1) * 20) + 1}-{Math.min(currentPage * 20, checkouts.length === 20 ? stats.totalCarts : ((currentPage - 1) * 20) + checkouts.length)}</span> of <span className="text-slate-600">{stats.totalCarts}</span>
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
        </div>
    );
}
