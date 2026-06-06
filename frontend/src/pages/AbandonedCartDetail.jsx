import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ShoppingCart, User, Mail, Phone, CheckCircle, Clock, Link as LinkIcon,
    AlertCircle, XCircle, Send, MapPin, Printer, Download, RefreshCw, MessageCircle, FileText,
    Copy, ExternalLink, Calendar
} from 'lucide-react';
import api from '../api/api';
import toast from 'react-hot-toast';

export default function AbandonedCartDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchCart = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/woocommerce/abandoned-carts/${id}`);
            if (response.data.success) {
                setCart(response.data.data);
            } else {
                setError(response.data.error || 'Failed to fetch cart');
            }
        } catch (err) {
            console.error('Error fetching cart details:', err);
            setError(err.response?.data?.error || 'Cart not found');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchCart();
    }, [id]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchCart();
    };

    const handlePrint = () => {
        window.print();
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success("Recovery link copied!");
    };

    const getStatusColor = (status) => {
        const s = (status || '').toLowerCase();
        if (['recovered', 'converted'].includes(s)) return 'text-blue-700 bg-blue-50 border-blue-200';
        if (['pending', 'active'].includes(s)) return 'text-amber-700 bg-amber-50 border-amber-200';
        if (['abandoned'].includes(s)) return 'text-red-700 bg-red-50 border-red-200';
        return 'text-gray-700 bg-gray-50 border-gray-200';
    };

    const formatCurrency = (amount, currency = 'USD') => {
        if (amount === undefined || amount === null) return 'N/A';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency || 'INR'
        }).format(amount);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
    };

    if (loading && !refreshing) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                <p className="mt-4 text-gray-500 font-medium">Loading Cart Details...</p>
            </div>
        );
    }

    if (error || !cart) {
        return (
            <div className="p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
                <div className="bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-gray-200 p-12 max-w-md mx-auto">
                    <XCircle className="mx-auto text-red-500 mb-4" size={48} />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{error || 'Cart Not Found'}</h2>
                    <p className="text-gray-500 mb-6 font-medium">We could not fetch the details for this cart.</p>
                    <button
                        onClick={() => navigate('/abandoned-carts')}
                        className="px-6 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        Return to Abandoned Carts
                    </button>
                </div>
            </div>
        );
    }

    const recoveryLink = cart.recovery_url || cart.payment_url;

    const handleWhatsAppChat = () => {
        if (cart.customer_phone) {
            const phoneNumber = cart.customer_phone.replace(/\D/g, '');
            // Navigate to internal messages page with the phone number and name
            navigate(`/messages?phone=${phoneNumber}&name=${encodeURIComponent(cart.customer_name || 'New Customer')}`);
        } else {
            toast.error("No phone number linked for WhatsApp");
        }
    };

    return (
        <div className="min-h-screen bg-[#F4F7FE] pb-12 font-poppins relative">

            {/* Context Header */}
            <div className="bg-[#F4F7FE] border-none px-4 md:px-10 py-8 sticky top-0 z-20">
                <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate('/abandoned-carts')}
                            className="w-10 h-10 border border-slate-200 hover:bg-white hover:text-blue-600 rounded-xl transition-all bg-white shadow-sm active:scale-95 group flex items-center justify-center font-semibold"
                        >
                            <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-blue-600" />
                        </button>
                        <div>
                            <div className="flex items-center gap-4 flex-wrap">
                                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Abandoned Cart Detail</h1>
                                <div className="flex items-center gap-2">
                                    <span className={`px-5 py-1.5 rounded-full text-[10px] font-bold border ${getStatusColor(cart.status)} uppercase tracking-widest leading-none shadow-sm`}>
                                        {cart.status}
                                    </span>
                                    {cart.whatsapp_sent && (
                                        <span className="px-5 py-1.5 rounded-full text-[10px] font-bold border text-blue-700 bg-blue-50 border-blue-200 uppercase tracking-widest flex items-center gap-1.5 leading-none shadow-sm">
                                            <Send size={12} /> WA SENT
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4 mt-3">
                                <nav className="flex items-center text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                                    <button onClick={() => navigate('/abandoned-carts')} className="hover:text-blue-600 transition-colors">Abandoned Carts</button>
                                    <span className="mx-3 opacity-30">/</span>
                                    <span className="text-slate-900">Cart Identification</span>
                                </nav>
                                <span className="h-4 w-[1px] bg-slate-300 mx-2" />
                                <p className="text-[13px] text-slate-500 flex items-center gap-2.5 font-semibold">
                                    <Calendar size={16} className="text-slate-400" />
                                    Abandoned: {formatDate(cart.abandoned_at)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full px-4 md:px-10">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                    {/* LEFT SECTION (75%) */}
                    <div className="lg:col-span-3 space-y-8">

                        {/* 1. Recovery Details Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden p-6">
                            <h2 className="font-semibold text-gray-900 text-lg flex items-center gap-2 mb-6 tracking-tight">
                                <LinkIcon size={18} className="text-gray-400" />
                                Recovery Link & Value
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5 opacity-80">Abandoned Cart Value</h3>
                                    <div className="text-3xl font-semibold text-blue-600 mb-2 tracking-tight">{formatCurrency(cart.total_amount, cart.currency)}</div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recovery URL</h3>
                                        {recoveryLink ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={recoveryLink}
                                                    className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded text-clip"
                                                />
                                                <button
                                                    onClick={() => copyToClipboard(recoveryLink)}
                                                    className="p-2 text-gray-500 hover:text-blue-600 bg-gray-50 border border-gray-200 hover:border-blue-200 rounded transition-colors"
                                                    title="Copy Link"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                                <a
                                                    href={recoveryLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 text-gray-500 hover:text-blue-600 bg-gray-50 border border-gray-200 hover:border-blue-200 rounded transition-colors"
                                                    title="Open Link"
                                                >
                                                    <ExternalLink size={16} />
                                                </a>
                                            </div>
                                        ) : (
                                            <p className="text-sm font-medium text-gray-500">Not available</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Order Items Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/30">
                                <ShoppingCart size={18} className="text-gray-400" />
                                <h2 className="font-semibold text-gray-900 text-lg tracking-tight">Cart Items</h2>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50/80 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {(cart.cart_items || []).map((item, idx) => {
                                            const linePrice = parseFloat(item.price);
                                            return (
                                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 bg-gray-100 rounded-md border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                                                                {item.image ? (
                                                                    <img src={item.image} alt={item.name} className="max-h-full max-w-full object-cover" />
                                                                ) : (
                                                                    <ShoppingCart size={18} className="text-gray-400" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <span className="block font-medium text-gray-900 text-sm whitespace-normal max-w-[200px] leading-snug">{item.name}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-sm font-medium text-gray-700">{item.quantity}</td>
                                                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">{formatCurrency(linePrice, cart.currency)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 3. WhatsApp Activity Card & Timeline Split */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Activity */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MessageCircle size={18} className="text-gray-400" />
                                        <h2 className="font-bold text-gray-900 text-lg font-sans">WhatsApp Activity</h2>
                                    </div>
                                </div>
                                <div className="p-6 space-y-5">
                                    {!cart.whatsapp_sent ? (
                                        <div className="flex flex-col items-center justify-center py-6 text-center">
                                            <div className="bg-gray-50 p-3 rounded-full mb-3">
                                                <Send size={24} className="text-gray-300" />
                                            </div>
                                            <p className="text-sm font-medium text-gray-600">Recovery automation pending check...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</p>
                                                <div className="flex items-center gap-1.5">
                                                    <CheckCircle size={16} className="text-blue-500" />
                                                    <span className="font-bold text-blue-700 text-sm">Recovery Template Sent</span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Sent Time</p>
                                                <p className="font-medium text-gray-900 text-sm">{formatDate(cart.whatsapp_sent_at || cart.updated_at)}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2">
                                    <FileText size={18} className="text-gray-400" />
                                    <h2 className="font-bold text-gray-900 text-lg font-sans">Cart Timeline</h2>
                                </div>
                                <div className="p-6">
                                    <div className="relative border-l border-gray-200 ml-3 space-y-6">

                                        <div className="relative pl-6">
                                            <div className="absolute w-3 h-3 bg-yellow-400 rounded-full -left-[6.5px] top-1.5 border-2 border-white ring-4 ring-white"></div>
                                            <p className="text-sm font-bold text-gray-900">Marked Abandoned</p>
                                            <p className="text-xs font-medium text-gray-500 mt-1">{formatDate(cart.abandoned_at)}</p>
                                        </div>

                                        {cart.whatsapp_sent && (
                                            <div className="relative pl-6">
                                                <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[6.5px] top-1.5 border-2 border-white ring-4 ring-white"></div>
                                                <p className="text-sm font-bold text-gray-900">Automation Triggered</p>
                                                <p className="text-xs font-medium text-gray-500 mt-1">Recovery WhatsApp Sent</p>
                                            </div>
                                        )}

                                        {(cart.status === 'recovered' || cart.recovered || cart.status === 'converted') ? (
                                            <div className="relative pl-6">
                                                <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[6.5px] top-1.5 border-2 border-white ring-4 ring-white"></div>
                                                <p className="text-sm font-bold text-gray-900">Successfully Converted</p>
                                                <p className="text-xs font-medium text-gray-500 mt-1">{formatDate(cart.recovered_at || cart.updated_at)}</p>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* RIGHT SECTION (30%) */}
                    <div className="space-y-6">

                        {/* 1. Customer Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                                <div className="flex items-center gap-2">
                                    <User size={18} className="text-gray-400" />
                                    <h2 className="font-semibold text-gray-900 text-lg tracking-tight">Potential Customer</h2>
                                </div>
                            </div>
                            <div className="p-6 space-y-5">
                                <div>
                                    <p className="font-semibold text-gray-900 tracking-tight text-base">{cart.customer_name || 'Anonymous'}</p>
                                </div>

                                <div className="pt-4 border-t border-gray-100 space-y-4 text-sm font-medium">
                                    <div className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3 text-gray-700">
                                            <Mail size={16} className="text-gray-400" />
                                            {cart.customer_email ? (
                                                <a href={`mailto:${cart.customer_email}`} className="hover:text-blue-600 transition-colors truncate max-w-[150px]">{cart.customer_email}</a>
                                            ) : (
                                                <span className="text-gray-400">No Email</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3 text-gray-700">
                                            <Phone size={16} className="text-gray-400" />
                                            <span>{cart.customer_phone || 'No Phone Collected'}</span>
                                        </div>
                                    </div>
                                </div>

                                {cart.customer_phone && (
                                    <button
                                        onClick={handleWhatsAppChat}
                                        className="w-full flex items-center justify-center gap-2 mt-4 px-4 py-3 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#128C7E] shadow-lg shadow-emerald-500/10 transition-all text-sm active:scale-95 uppercase tracking-widest"
                                    >
                                        <MessageCircle size={18} /> WhatsApp Follow-up
                                    </button>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
