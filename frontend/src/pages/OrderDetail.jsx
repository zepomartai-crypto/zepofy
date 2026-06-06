import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Package, User, Mail, Phone, CreditCard, Calendar, CheckCircle, Clock,
    AlertCircle, XCircle, Send, MapPin, Printer, Download, RefreshCw, MessageCircle, FileText, Anchor
} from 'lucide-react';
import api from '../api/api';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';

export default function OrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchOrder = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/woocommerce/orders/${id}`);
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

    const handleRefresh = () => {
        setRefreshing(true);
        fetchOrder();
    };

    const handlePrint = () => {
        window.print();
    };

    const getStatusColor = (status) => {
        const s = (status || '').toLowerCase();
        if (['completed', 'paid', 'sent', 'fulfilled'].includes(s)) return 'text-blue-700 bg-blue-50 border-blue-200';
        if (['processing'].includes(s)) return 'text-blue-700 bg-blue-50 border-blue-200';
        if (['failed', 'cancelled', 'canceled'].includes(s)) return 'text-red-700 bg-red-50 border-red-200';
        return 'text-yellow-700 bg-yellow-50 border-yellow-200'; // Default to pending/yellow
    };

    const formatCurrency = (amount, currency = 'USD') => {
        if (!amount && amount !== 0) return 'N/A';
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
                <p className="mt-4 text-gray-500 font-medium">Loading Order Details...</p>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
                <div className="bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-gray-200 p-12 max-w-md mx-auto">
                    <XCircle className="mx-auto text-red-500 mb-4" size={48} />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{error || 'Order Not Found'}</h2>
                    <p className="text-gray-500 mb-6 font-medium">We could not fetch the details for this order.</p>
                    <button
                        onClick={() => navigate('/woocommerce/orders')}
                        className="px-6 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        Return to Orders
                    </button>
                </div>
            </div>
        );
    }

    const payload = order.rawPayload || {};
    const shippingTotal = parseFloat(payload.shipping_total || 0);
    const taxTotal = parseFloat(payload.total_tax || 0);
    const discountTotal = parseFloat(payload.discount_total || 0);

    const handleWhatsAppChat = () => {
        if (order.customerPhone) {
            const phoneNumber = order.customerPhone.replace(/\D/g, '');
            // Navigate to internal messages page with the phone number and name
            navigate(`/messages?phone=${phoneNumber}&name=${encodeURIComponent(order.customerName || 'New Customer')}`);
        } else {
            toast.error("No phone number linked for WhatsApp");
        }
    };

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden font-poppins text-slate-900">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/woocommerce/orders')}
              className="w-10 h-10 border border-slate-200 hover:bg-white hover:text-blue-600 rounded-xl transition-all bg-white shadow-sm active:scale-95 group flex items-center justify-center font-semibold"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-blue-600" />
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Order #{order.orderNumber || order.orderId}</h1>
                <span className={cn(
                  "px-2.5 py-1 rounded-lg text-[9px] font-bold border uppercase tracking-widest leading-none shadow-sm",
                  getStatusColor(order.status)
                )}>
                  {order.status}
                </span>
                {order.whatsapp_sent && (
                  <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold border text-blue-700 bg-blue-50 border-blue-200 uppercase tracking-widest flex items-center gap-1.5 leading-none shadow-sm">
                    <Send size={10} /> WA SENT
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <nav className="flex items-center text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                  <button onClick={() => navigate('/woocommerce/orders')} className="hover:text-blue-600 transition-colors">Orders</button>
                  <span className="mx-2 opacity-30">/</span>
                  <span className="text-slate-900">Order Detail</span>
                </nav>
                <span className="h-3 w-[1px] bg-slate-300 mx-1" />
                <p className="text-[11px] text-slate-500 flex items-center gap-2 font-medium">
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
                      <th className="px-6 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Product</th>
                      <th className="px-6 py-3 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Qty</th>
                      <th className="px-6 py-3 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Price</th>
                      <th className="px-6 py-3 text-right text-[10px] font-semibold text-blue-600 uppercase tracking-widest">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(order.lineItems || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/40 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
                              <Package className="w-5 h-5 text-slate-300" />
                            </div>
                            <div className="min-w-0">
                              <span className="block font-bold text-slate-800 text-sm leading-snug group-hover:text-blue-600 transition-colors">{item.name}</span>
                              {item.sku && <span className="block text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">SKU: {item.sku}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-bold text-slate-800">{item.quantity}</td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-slate-800">{formatCurrency(item.price, order.currency)}</td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">{formatCurrency(item.total, order.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary */}
              <div className="border-t border-slate-50 bg-slate-50/30 p-6 flex justify-end">
                <div className="w-full sm:w-1/2 space-y-3">
                  <div className="flex justify-between text-sm font-medium text-slate-500">
                    <span>Subtotal</span>
                    <span className="text-slate-800">{formatCurrency(order.totalAmount - (order.rawPayload?.total_tax || 0) - (order.rawPayload?.shipping_total || 0) + (order.rawPayload?.discount_total || 0), order.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium text-slate-500">
                    <span>Discount</span>
                    <span className="text-red-500">-{formatCurrency(order.rawPayload?.discount_total || 0, order.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium text-slate-500">
                    <span>Shipping</span>
                    <span className="text-slate-800">{formatCurrency(order.rawPayload?.shipping_total || 0, order.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium text-slate-500">
                    <span>Tax</span>
                    <span className="text-slate-800">{formatCurrency(order.rawPayload?.total_tax || 0, order.currency)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold text-slate-900 pt-4 border-t border-slate-100 mt-3">
                    <span className="tracking-tight uppercase">Grand Total</span>
                    <span className="text-blue-600">{formatCurrency(order.totalAmount, order.currency)}</span>
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
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Payment Method</p>
                  <p className="font-bold text-slate-800 text-sm">{order.paymentMethod || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Payment Status</p>
                  <span className={cn(
                    "inline-flex px-3 py-1 rounded-lg text-[9px] font-bold border uppercase tracking-widest leading-none",
                    order.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-700 border-slate-100'
                  )}>
                    {order.status === 'completed' ? 'Paid' : 'Pending'}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Transaction ID</p>
                  <p className="font-bold text-slate-800 text-sm truncate" title={order.rawPayload?.transaction_id}>{order.rawPayload?.transaction_id || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* 3. WhatsApp Activity & Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* WhatsApp Activity */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2.5 bg-slate-50/20">
                  <MessageCircle className="w-4.5 h-4.5 text-slate-400" />
                  <h2 className="font-bold text-slate-800 text-base tracking-tight">WhatsApp Activity</h2>
                </div>
                <div className="p-6">
                  {!order.whatsapp_sent ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="bg-slate-50 p-4 rounded-full mb-3">
                        <Send className="w-6 h-6 text-slate-200" />
                      </div>
                      <p className="text-sm font-bold text-slate-600">No automation triggered yet</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Pending delivery conditions</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Outreach Status</p>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                            <CheckCircle size={16} className="text-blue-500" />
                          </div>
                          <span className="font-semibold text-blue-700 text-sm leading-tight">Order Status Template Sent</span>
                        </div>
                      </div>
                      <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-all text-[11px] shadow-sm active:scale-95 uppercase tracking-widest">
                        <RefreshCw size={14} /> Resend Template
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2.5 bg-slate-50/20">
                  <FileText className="w-4.5 h-4.5 text-slate-400" />
                  <h2 className="font-bold text-slate-800 text-base tracking-tight">Timeline</h2>
                </div>
                <div className="p-6">
                  <div className="relative border-l-2 border-slate-100 ml-2 space-y-8">
                    <div className="relative pl-6">
                      <div className="absolute w-3 h-3 bg-slate-200 rounded-full -left-[7px] top-1 border-2 border-white shadow-sm" />
                      <p className="text-sm font-semibold text-slate-800">Order Placed</p>
                      <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">{formatDate(order.createdAt)}</p>
                    </div>
                    {order.whatsapp_sent && (
                      <div className="relative pl-6">
                        <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1 border-2 border-white shadow-md" />
                        <p className="text-sm font-semibold text-slate-800">Automation Triggered</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-widest leading-none">Confirmation WhatsApp Sent</p>
                      </div>
                    )}
                    <div className="relative pl-6">
                      <div className={`absolute w-3 h-3 ${order.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-400'} rounded-full -left-[7px] top-1 border-2 border-white shadow-md`} />
                      <p className="text-sm font-semibold text-slate-800 uppercase tracking-[.3em]">Order {order.status}</p>
                      <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-widest">Status changed by System</p>
                    </div>
                  </div>
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
                  <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-semibold text-lg border border-blue-100/50 shadow-sm">
                    {order.customerName?.[0] || 'G'}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 tracking-tight text-base leading-tight uppercase">{order.customerName || 'Guest Customer'}</p>
                    <p className="text-[10px] font-medium text-blue-500 uppercase tracking-widest mt-1">Active Customer</p>
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-50 space-y-4">
                  <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="h-9 w-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-colors">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Email Address</p>
                      <a href={`mailto:${order.customerEmail}`} className="text-sm font-medium text-slate-700 block truncate hover:text-blue-600 transition-colors lowercase">{order.customerEmail || 'No Email Linked'}</a>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="h-9 w-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-emerald-500 group-hover:bg-emerald-50 transition-colors ">
                      <Phone className="w-3.5 h-3.5 " />
                    </div>
                    <div className="min-w-0 flex-1 ">
                      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5 ">Phone Number</p>
                      <span className="text-sm font-medium text-slate-700">{order.customerPhone || 'No Phone Number'}</span>
                    </div>
                  </div>
                </div>

                {order.customerPhone && (
                  <button
                    onClick={handleWhatsAppChat}
                    className="w-full h-11 flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#128C7E] shadow-lg shadow-emerald-500/20 active:scale-95 uppercase tracking-widest text-[11px]"
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
                <h2 className="font-bold text-slate-800 text-base tracking-tight">Full Address</h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <p className="text-[9px] font-semibold text-blue-500 uppercase tracking-widest border-b border-blue-50 pb-1.5">Billing Details</p>
                  {order.billing ? (
                    <address className="not-italic text-sm font-medium text-slate-600 leading-relaxed uppercase">
                      <span className="block text-slate-900 font-semibold text-sm mb-0.5">{order.billing.first_name} {order.billing.last_name}</span>
                      {order.billing.company && <span className="block text-slate-500 mb-1">{order.billing.company}</span>}
                      <span className="block">{order.billing.address_1}</span>
                      {order.billing.address_2 && <span className="block">{order.billing.address_2}</span>}
                      <span className="block">{order.billing.city}, {order.billing.state} {order.billing.postcode}</span>
                      <span className="block text-slate-400 mt-1 uppercase text-[10px] tracking-wider">{order.billing.country}</span>
                    </address>
                  ) : (
                    <p className="text-xs font-semibold text-slate-400">No billing data found</p>
                  )}
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-50">
                  <p className="text-[9px] font-semibold text-amber-500 uppercase tracking-widest border-b border-amber-50 pb-1.5">Shipping Details</p>
                  {order.shipping ? (
                    <address className="not-italic text-sm font-medium text-slate-600 leading-relaxed uppercase">
                      <span className="block text-slate-900 font-semibold text-sm mb-0.5">{order.shipping.first_name || order.billing?.first_name} {order.shipping.last_name || order.billing?.last_name}</span>
                      {order.shipping.company && <span className="block text-slate-500 mb-1">{order.shipping.company}</span>}
                      <span className="block">{order.shipping.address_1}</span>
                      {order.shipping.address_2 && <span className="block">{order.shipping.address_2}</span>}
                      <span className="block">{order.shipping.city}, {order.shipping.state} {order.shipping.postcode}</span>
                      <span className="block text-slate-400 mt-1 uppercase text-[10px] tracking-wider font-semibold">{order.shipping.country}</span>
                    </address>
                  ) : (
                    <div className="py-4 px-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center uppercase">
                      <p className="text-[11px] font-semibold text-slate-400">Same as billing</p>
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
