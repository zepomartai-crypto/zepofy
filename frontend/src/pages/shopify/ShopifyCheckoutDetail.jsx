import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ShoppingCart, User, Mail, Phone, CheckCircle, Clock, Link as LinkIcon,
    AlertCircle, XCircle, Send, MapPin, Printer, Download, RefreshCw, MessageCircle, FileText,
    Copy, ExternalLink, Calendar
} from 'lucide-react';
import api from '../../api/api';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';

export default function ShopifyCheckoutDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [checkout, setCheckout] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchCheckout = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/shopify/abandoned/${id}`);
            if (response.data.success) {
                setCheckout(response.data.data);
            } else {
                setError(response.data.error || 'Failed to fetch checkout');
            }
        } catch (err) {
            console.error('Error fetching checkout details:', err);
            setError(err.response?.data?.error || 'Checkout not found');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchCheckout();
    }, [id]);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success("Recovery link copied!");
    };

    const getStatusColor = (status) => {
        const s = (status || '').toLowerCase();
        if (['recovered', 'converted'].includes(s)) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
        if (['pending', 'active'].includes(s)) return 'text-amber-700 bg-amber-50 border-amber-200';
        if (['failed', 'lost'].includes(s)) return 'text-red-700 bg-red-50 border-red-200';
        return 'text-slate-700 bg-slate-50 border-slate-200';
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
                <p className="mt-4 text-slate-500 font-medium font-bold italic">Loading Checkout Details...</p>
            </div>
        );
    }

    if (error || !checkout) {
        return (
            <div className="p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
                <div className="bg-white rounded-[32px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 p-12 max-w-md mx-auto">
                    <XCircle className="mx-auto text-red-500 mb-4 font-bold italic" size={48} />
                    <h2 className="text-xl font-bold text-slate-900 mb-2 font-bold italic">{error || 'Checkout Not Found'}</h2>
                    <p className="text-slate-500 mb-6 font-medium italic">We could not fetch the details for this checkout.</p>
                    <button
                        onClick={() => navigate('/shopify/checkouts')}
                        className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors uppercase font-bold italic"
                    >
                        Return to Checkouts
                    </button>
                </div>
            </div>
        );
    }

    const payload = checkout.rawPayload || {};
    const shippingAddress = payload.shipping_address || payload.billing_address || {};

    const handleWhatsAppChat = () => {
        if (checkout.customerPhone) {
            const phoneNumber = checkout.customerPhone.replace(/\D/g, '');
            navigate(`/messages?phone=${phoneNumber}&name=${encodeURIComponent(checkout.customerName || 'New Customer')}`);
        } else {
            toast.error("No phone number linked for WhatsApp");
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden font-poppins text-slate-900 uppercase italic">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/shopify/checkouts')}
                            className="w-10 h-10 border border-slate-200 hover:bg-white hover:text-blue-600 rounded-xl transition-all bg-white shadow-sm active:scale-95 group flex items-center justify-center font-bold italic"
                        >
                            <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-blue-600" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Abandoned Checkout</h1>
                                <span className={cn(
                                    "px-2.5 py-1 rounded-lg text-[9px] font-bold border uppercase tracking-widest leading-none shadow-sm font-bold italic",
                                    getStatusColor(checkout.status)
                                )}>
                                    {checkout.status}
                                </span>
                                {checkout.whatsappSent && (
                                    <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold border text-blue-700 bg-blue-50 border-blue-200 uppercase tracking-widest flex items-center gap-1.5 leading-none shadow-sm font-bold italic">
                                        <Send size={10} /> WA SENT
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 font-bold italic">
                                <nav className="flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest font-bold italic">
                                    <button onClick={() => navigate('/shopify/checkouts')} className="hover:text-blue-600 transition-colors uppercase italic font-bold">Abandoned Checkouts</button>
                                    <span className="mx-2 opacity-30">/</span>
                                    <span className="text-slate-900 uppercase italic font-bold">Cart Identification</span>
                                </nav>
                                <span className="h-3 w-[1px] bg-slate-300 mx-1 font-bold italic" />
                                <p className="text-[11px] text-slate-500 flex items-center gap-2 font-semibold lowercase italic font-bold">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400 font-bold italic" />
                                    Abandoned: {formatDate(checkout.abandonedAt || checkout.createdAt)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-10 custom-scrollbar uppercase italic">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                    {/* Left Column (Main Content) */}
                    <div className="lg:col-span-3 space-y-6">

                        {/* 1. Recovery Pipeline Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden p-6 font-bold italic">
                            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2 mb-6 tracking-tight font-bold italic">
                                <LinkIcon size={18} className="text-slate-400 font-bold italic" />
                                Recovery Pipeline
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-bold italic">
                                <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100 italic">
                                    <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1 italic">Abandoned Cart Value</h3>
                                    <div className="text-2xl font-bold text-blue-600 tracking-tight italic font-bold">{formatCurrency(checkout.cartValue, checkout.currency)}</div>
                                </div>

                                <div className="space-y-4 font-bold italic">
                                    <div className="font-bold italic">
                                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-bold italic">Recovery URL</h3>
                                        {checkout.checkoutUrl ? (
                                            <div className="flex items-center gap-2 font-bold italic">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={checkout.checkoutUrl}
                                                    className="w-full px-3 py-2 text-[13px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-300 transition-colors font-bold italic"
                                                />
                                                <button
                                                    onClick={() => copyToClipboard(checkout.checkoutUrl)}
                                                    className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-200 rounded-lg transition-all shadow-sm active:scale-95 italic font-bold"
                                                    title="Copy Link"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                                <a
                                                    href={checkout.checkoutUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-200 rounded-lg transition-all shadow-sm active:scale-95 italic font-bold"
                                                    title="Open Link"
                                                >
                                                    <ExternalLink size={16} />
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="py-2.5 px-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center font-bold italic">
                                                <p className="text-[11px] font-bold text-slate-400 font-bold italic lowercase">No recovery link generated yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Cart Items Table */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden font-bold italic">
                            <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2.5 bg-slate-50/20 font-bold italic">
                                <ShoppingCart size={18} className="text-slate-400 font-bold italic" />
                                <h2 className="font-bold text-slate-800 text-base tracking-tight font-bold italic">Cart Contents</h2>
                            </div>

                            <div className="overflow-x-auto font-bold italic">
                                <table className="w-full text-left border-collapse font-bold italic">
                                    <thead className="bg-slate-50/50 border-b border-slate-50 font-bold italic">
                                        <tr>
                                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-bold italic">Product</th>
                                            <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest font-bold italic">Qty</th>
                                            <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest font-bold italic">Unit Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 font-bold italic">
                                        {(checkout.products || payload.line_items || []).map((item, idx) => {
                                            const linePrice = parseFloat(item.price);
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/40 transition-colors group font-bold italic">
                                                    <td className="px-6 py-4 font-bold italic">
                                                        <div className="flex items-center gap-3 font-bold italic">
                                                            <div className="h-10 w-10 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden group-hover:bg-white transition-colors font-bold italic">
                                                                {item.imageUrl ? (
                                                                    <img src={item.imageUrl} alt={item.title} className="max-h-full max-w-full object-cover font-bold italic" />
                                                                ) : (
                                                                    <ShoppingCart size={18} className="text-slate-300 font-bold italic" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 font-bold italic">
                                                                <span className="block font-bold text-slate-800 text-sm leading-snug group-hover:text-blue-600 transition-colors font-bold italic">{item.title || item.name}</span>
                                                                {item.sku && <span className="block text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest font-bold italic">SKU: {item.sku}</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-sm font-bold text-slate-700 font-bold italic">{item.quantity}</td>
                                                    <td className="px-6 py-4 text-right text-sm font-bold text-slate-900 font-bold italic">{formatCurrency(linePrice, checkout.currency)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 3. Recovery & Timeline Split */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-bold italic">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden font-bold italic">
                                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between font-bold italic">
                                    <div className="flex items-center gap-2 font-bold italic">
                                        <MessageCircle size={18} className="text-slate-400 font-bold italic" />
                                        <h2 className="font-bold text-slate-800 text-base tracking-tight font-bold italic">Recovery Status</h2>
                                    </div>
                                </div>
                                <div className="p-6 space-y-5 font-bold italic">
                                    {!checkout.whatsappSent ? (
                                        <div className="flex flex-col items-center justify-center py-6 text-center font-bold italic">
                                            <div className="bg-slate-50 p-4 rounded-full mb-3 font-bold italic">
                                                <Send size={24} className="text-slate-200 font-bold italic" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-600 font-bold italic">Pending recovery check...</p>
                                            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold italic">Scheduled for re-sync</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="font-bold italic">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 opacity-80 font-bold italic">Process Status</p>
                                                <div className="flex items-center gap-2 font-bold italic">
                                                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center font-bold italic">
                                                        <CheckCircle size={16} className="text-blue-500 font-bold italic" />
                                                    </div>
                                                    <span className="font-bold text-blue-700 text-sm font-bold italic">RECOVERY MESSAGE SENT</span>
                                                </div>
                                            </div>
                                            <div className="font-bold italic">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-bold italic uppercase">Delivery Time</p>
                                                <p className="font-bold text-slate-800 text-sm font-bold italic lowercase">{formatDate(checkout.whatsappSentAt || checkout.updatedAt)}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden font-bold italic">
                                <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2.5 bg-slate-50/20 font-bold italic">
                                    <FileText size={18} className="text-slate-400 font-bold italic" />
                                    <h2 className="font-bold text-slate-800 text-base tracking-tight font-bold italic">Audit Timeline</h2>
                                </div>
                                <div className="p-6 font-bold italic">
                                    <div className="relative border-l border-slate-100 ml-2 space-y-6 font-bold italic">
                                        <div className="relative pl-6 font-bold italic">
                                            <div className="absolute w-2.5 h-2.5 bg-slate-200 rounded-full -left-[5.5px] top-1.5 border-2 border-white font-bold italic"></div>
                                            <p className="text-sm font-bold text-slate-800 font-bold italic">Checkout Started</p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5 lowercase font-bold italic">{formatDate(checkout.createdAt)}</p>
                                        </div>

                                        <div className="relative pl-6 font-bold italic">
                                            <div className="absolute w-2.5 h-2.5 bg-amber-400 rounded-full -left-[5.5px] top-1.5 border-2 border-white font-bold italic"></div>
                                            <p className="text-sm font-bold text-slate-800 font-bold italic">Flagged Abandoned</p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest font-bold italic">Platform Identification</p>
                                        </div>

                                        {checkout.whatsappSent && (
                                            <div className="relative pl-6 font-bold italic">
                                                <div className="absolute w-2.5 h-2.5 bg-blue-500 rounded-full -left-[5.5px] top-1.5 border-2 border-white font-bold italic"></div>
                                                <p className="text-sm font-bold text-slate-800 tracking-tight font-bold italic">Recovery Attempted</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-0.5 font-bold italic">WhatsApp Sent</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Sidebars) */}
                    <div className="lg:col-span-1 space-y-6 font-bold italic">

                        {/* 1. Customer Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden font-bold italic">
                            <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2.5 bg-slate-50/20 font-bold italic">
                                <User size={18} className="text-slate-400 font-bold italic" />
                                <h2 className="font-bold text-slate-800 text-base tracking-tight font-bold italic">Buyer</h2>
                            </div>
                            <div className="p-6 space-y-5 font-bold italic">
                                <div className="font-bold italic">
                                    <p className="font-bold text-slate-900 tracking-tight text-base leading-tight uppercase italic font-bold">{checkout.customerName || 'Anonymous Buyer'}</p>
                                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1 font-bold italic">Guest Session</p>
                                </div>

                                <div className="pt-5 border-t border-slate-50 space-y-4 font-bold italic">
                                    <div className="flex items-center gap-3 font-bold italic">
                                        <div className="h-9 w-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 font-bold italic">
                                            <Mail size={14} className="font-bold italic" />
                                        </div>
                                        <div className="min-w-0 flex-1 font-bold italic">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 font-bold italic">Email</p>
                                            <a href={`mailto:${checkout.customerEmail}`} className="text-[13px] font-bold text-slate-700 hover:text-blue-600 transition-colors block truncate lowercase font-bold italic">{checkout.customerEmail || 'No Email Provided'}</a>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 font-bold italic">
                                        <div className="h-9 w-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 font-bold italic">
                                            <Phone size={14} className="font-bold italic" />
                                        </div>
                                        <div className="min-w-0 flex-1 font-bold italic">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 font-bold italic">Reach</p>
                                            <span className="text-[13px] font-bold text-slate-700 font-bold italic">{checkout.customerPhone || 'Not Found'}</span>
                                        </div>
                                    </div>
                                </div>

                                {checkout.customerPhone && (
                                    <button
                                        onClick={handleWhatsAppChat}
                                        className="w-full h-11 flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#128C7E] shadow-lg shadow-emerald-500/20 active:scale-95 uppercase tracking-widest text-[11px] italic font-bold"
                                    >
                                        <MessageCircle size={16} fill="white" className="font-bold italic" /> WhatsApp
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 2. Geography Details Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden font-bold italic">
                            <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2.5 bg-slate-50/20 font-bold italic">
                                <MapPin size={18} className="text-slate-400 font-bold italic" />
                                <h2 className="font-bold text-slate-800 text-base tracking-tight font-bold italic">Context</h2>
                            </div>
                            <div className="p-6 font-bold italic">
                                <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest border-b border-blue-50 pb-1.5 mb-3 font-bold italic">Location</p>
                                {shippingAddress.city ? (
                                    <address className="not-italic text-[13px] font-bold text-slate-600 leading-relaxed uppercase tracking-tight italic font-bold italic">
                                        <span className="block text-slate-900 font-bold mb-0.5 italic">{shippingAddress.city}</span>
                                        <span className="block italic">{shippingAddress.province || shippingAddress.state}</span>
                                        <span className="block italic">{shippingAddress.country}</span>
                                    </address>
                                ) : (
                                    <p className="text-xs font-bold text-slate-400 italic font-bold italic">No geographic data</p>
                                )}

                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-6 mb-2 font-bold italic">Consent</p>
                                <span className={cn(
                                    "inline-flex px-3 py-1 rounded-lg text-[9px] font-bold border uppercase tracking-widest font-bold italic font-bold italic",
                                    payload.buyer_accepts_marketing ? 'bg-blue-50 text-blue-700 border-blue-200 font-bold italic' : 'bg-slate-50 text-slate-700 border-slate-100 font-bold italic'
                                )}>
                                    {payload.buyer_accepts_marketing ? 'Subscribed' : 'No Consent'}
                                </span>
                            </div>
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
