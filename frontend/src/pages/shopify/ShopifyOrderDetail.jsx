import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Package, User, Mail, Phone, CreditCard, Calendar, CheckCircle, Clock,
    AlertCircle, XCircle, Send, MapPin, Printer, Download, RefreshCw, MessageCircle, FileText, Anchor
} from 'lucide-react';
import api from '../../api/api';
import { cn } from '../../utils/cn';
import toast from 'react-hot-toast';

export default function ShopifyOrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchOrder = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/shopify/orders/${id}`);
            if (response.data.success) {
                setOrder(response.data.data);
            } else {
                setError(response.data.error || 'Failed to fetch order');
            }
        } catch (err) {
            console.error('Error fetching order details:', err);
            setError(err.response?.data?.error || 'Order not found');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchOrder();
    }, [id]);

    const getStatusColor = (status) => {
        const s = (status || '').toLowerCase();
        if (['paid', 'fulfilled', 'completed'].includes(s)) return 'text-blue-700 bg-blue-50 border-blue-200';
        if (['partially_fulfilled', 'processing'].includes(s)) return 'text-blue-700 bg-blue-50 border-blue-200';
        if (['refunded', 'voided', 'cancelled', 'canceled'].includes(s)) return 'text-red-700 bg-red-50 border-red-200';
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
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
                <p className="mt-4 text-slate-500 font-medium">Loading Shopify Order Details...</p>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
                <div className="bg-white rounded-[32px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 p-12 max-w-md mx-auto">
                    <XCircle className="mx-auto text-red-500 mb-4" size={48} />
                    <h2 className="text-xl font-bold text-slate-900 mb-2">{error || 'Order Not Found'}</h2>
                    <p className="text-slate-500 mb-6 font-medium">We could not fetch the details for this order.</p>
                    <button
                        onClick={() => navigate('/shopify/orders')}
                        className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        Return to Orders
                    </button>
                </div>
            </div>
        );
    }

    const payload = order.rawPayload || {};
    const shippingTotal = parseFloat(payload.total_shipping_price_set?.shop_money?.amount || 0);
    const taxTotal = parseFloat(payload.total_tax || 0);
    const subtotal = parseFloat(payload.subtotal_price || (parseFloat(order.orderTotal || 0) - taxTotal - shippingTotal));
    const billing = payload.billing_address || {};
    const shipping = payload.shipping_address || billing;

    const handleWhatsAppChat = () => {
        if (order.customerPhone) {
            const phoneNumber = order.customerPhone.replace(/\D/g, '');
            navigate(`/messages?phone=${phoneNumber}&name=${encodeURIComponent(order.customerName || 'New Customer')}`);
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
                            onClick={() => navigate('/shopify/orders')}
                            className="w-10 h-10 border border-slate-200 hover:bg-white hover:text-blue-600 rounded-xl transition-all bg-white shadow-sm active:scale-95 group flex items-center justify-center font-bold italic"
                        >
                            <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-blue-600" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Order #{order.orderNumber}</h1>
                                <span className={cn(
                                    "px-2.5 py-1 rounded-lg text-[9px] font-bold border uppercase tracking-widest leading-none shadow-sm",
                                    getStatusColor(order.orderStatus)
                                )}>
                                    {order.orderStatus}
                                </span>
                                {order.whatsappSent && (
                                    <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold border text-blue-700 bg-blue-50 border-blue-200 uppercase tracking-widest flex items-center gap-1.5 leading-none shadow-sm">
                                        <Send size={10} /> WA SENT
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                                <nav className="flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    <button onClick={() => navigate('/shopify/orders')} className="hover:text-blue-600 transition-colors">Shopify Orders</button>
                                    <span className="mx-2 opacity-30">/</span>
                                    <span className="text-slate-900">Order Detail</span>
                                </nav>
                                <span className="h-3 w-[1px] bg-slate-300 mx-1" />
                                <p className="text-[11px] text-slate-500 flex items-center gap-2 font-semibold lowercase italic">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    {formatDate(order.createdAt)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-10 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Left Column */}
                    <div className="lg:col-span-8 space-y-6">
                        
                        {/* 1. Order Items Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2.5 bg-slate-50/20">
                                <Package className="w-4.5 h-4.5 text-slate-400" />
                                <h2 className="font-bold text-slate-800 text-base tracking-tight">Order Items</h2>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/50 border-b border-slate-50">
                                        <tr>
                                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Product</th>
                                            <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Qty</th>
                                            <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Price</th>
                                            <th className="px-6 py-3 text-right text-[10px] font-bold text-blue-600 uppercase tracking-widest">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {(order.items || payload.line_items || []).map((item, idx) => {
                                            const linePrice = parseFloat(item.price);
                                            const lineTotal = linePrice * (item.quantity || 1);
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/40 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
                                                                <Package className="w-5 h-5 text-slate-300" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="block font-bold text-slate-800 text-sm leading-snug group-hover:text-blue-600 transition-colors">{item.title || item.name}</span>
                                                                {item.sku && <span className="block text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">SKU: {item.sku}</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-sm font-bold text-slate-800">{item.quantity}</td>
                                                    <td className="px-6 py-4 text-right text-sm font-bold text-slate-800">{formatCurrency(linePrice, order.currency)}</td>
                                                    <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">{formatCurrency(lineTotal, order.currency)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Financial Summary */}
                            <div className="border-t border-slate-50 bg-slate-50/30 p-6 flex justify-end lowecase italic">
                                <div className="w-full sm:w-1/2 space-y-3">
                                    <div className="flex justify-between text-sm font-bold text-slate-500">
                                        <span>Subtotal</span>
                                        <span className="text-slate-800">{formatCurrency(subtotal, order.currency)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold text-slate-500">
                                        <span>Shipping</span>
                                        <span className="text-slate-800">{formatCurrency(shippingTotal, order.currency)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold text-slate-500">
                                        <span>Tax</span>
                                        <span className="text-slate-800">{formatCurrency(taxTotal, order.currency)}</span>
                                    </div>
                                    <div className="flex justify-between text-base font-bold text-slate-900 pt-4 border-t border-slate-100 mt-3">
                                        <span className="tracking-tight uppercase italic">Grand Total</span>
                                        <span className="text-blue-600">{formatCurrency(order.orderTotal, order.currency)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Payment Information Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2.5 bg-slate-50/20">
                                <CreditCard className="w-4.5 h-4.5 text-slate-400" />
                                <h2 className="font-bold text-slate-800 text-base tracking-tight">Payment Information</h2>
                            </div>
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Gateways</p>
                                    <p className="font-bold text-slate-800 text-sm">{payload.payment_gateway_names?.join(', ') || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Financial Status</p>
                                    <span className={cn(
                                        "inline-flex px-3 py-1 rounded-lg text-[9px] font-bold border uppercase tracking-widest leading-none",
                                        order.orderStatus === 'paid' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-700 border-slate-100'
                                    )}>
                                        {order.orderStatus || 'Pending'}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Fulfillment</p>
                                    <p className="font-bold text-slate-800 text-sm uppercase">{order.fulfillmentStatus || payload.fulfillment_status || 'unfulfilled'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* 1. Customer Information Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2.5 bg-slate-50/20">
                                <User className="w-4.5 h-4.5 text-slate-400" />
                                <h2 className="font-bold text-slate-800 text-base tracking-tight">Customer</h2>
                            </div>
                            <div className="p-6 space-y-5">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-bold text-lg border border-blue-100/50 shadow-sm">
                                        {order.customerName?.[0] || 'G'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 tracking-tight text-base leading-tight uppercase italic">{order.customerName || 'Guest Customer'}</p>
                                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Platform Buyer</p>
                                    </div>
                                </div>

                                <div className="pt-5 border-t border-slate-50 space-y-4">
                                    <div className="flex items-center gap-3 group cursor-pointer font-bold italic">
                                        <div className="h-9 w-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-colors">
                                            <Mail className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Email</p>
                                            <a href={`mailto:${order.customerEmail}`} className="text-sm font-bold text-slate-700 block truncate hover:text-blue-600 transition-colors lowercase italic">{order.customerEmail || 'No Email Linked'}</a>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 group cursor-pointer font-bold italic">
                                        <div className="h-9 w-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-emerald-500 group-hover:bg-emerald-50 transition-colors">
                                            <Phone className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Contact</p>
                                            <span className="text-sm font-bold text-slate-700">{order.customerPhone || 'No Phone Number'}</span>
                                        </div>
                                    </div>
                                </div>

                                {order.customerPhone && (
                                    <button
                                        onClick={handleWhatsAppChat}
                                        className="w-full h-11 flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#128C7E] shadow-lg shadow-emerald-500/20 active:scale-95 uppercase tracking-widest text-[11px] italic font-bold"
                                    >
                                        <MessageCircle size={16} fill="white" /> WhatsApp Chat
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 2. Addresses Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2.5 bg-slate-50/20">
                                <MapPin className="w-4.5 h-4.5 text-slate-400" />
                                <h2 className="font-bold text-slate-800 text-base tracking-tight">Destinations</h2>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-3">
                                    <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest border-b border-blue-50 pb-1.5 font-bold italic">Billing Address</p>
                                    {billing.address1 ? (
                                        <address className="not-italic text-sm font-bold text-slate-600 leading-relaxed uppercase italic">
                                            <span className="block text-slate-900 font-bold text-sm mb-0.5">{billing.first_name} {billing.last_name}</span>
                                            <span className="block">{billing.address1}</span>
                                            <span className="block">{billing.city}, {billing.province} {billing.zip}</span>
                                            <span className="block text-slate-400 mt-1 uppercase text-[10px] tracking-wider">{billing.country}</span>
                                        </address>
                                    ) : (
                                        <p className="text-xs font-bold text-slate-400 italic">Address unspecified</p>
                                    )}
                                </div>

                                <div className="space-y-3 pt-4 border-t border-slate-50">
                                    <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest border-b border-amber-50 pb-1.5 font-bold italic">Shipping Address</p>
                                    {shipping.address1 ? (
                                        <address className="not-italic text-sm font-bold text-slate-600 leading-relaxed uppercase italic">
                                            <span className="block text-slate-900 font-bold text-sm mb-0.5">{shipping.first_name || billing?.first_name} {shipping.last_name || billing?.last_name}</span>
                                            <span className="block">{shipping.address1}</span>
                                            <span className="block">{shipping.city}, {shipping.province} {shipping.zip}</span>
                                            <span className="block text-slate-400 mt-1 uppercase text-[10px] tracking-wider font-bold italic">{shipping.country}</span>
                                        </address>
                                    ) : (
                                        <div className="py-4 px-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center uppercase italic">
                                            <p className="text-[11px] font-bold text-slate-400">Same as billing</p>
                                        </div>
                                    )}
                                </div>
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
