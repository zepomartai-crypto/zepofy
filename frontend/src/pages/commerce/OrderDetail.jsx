import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  User,
  Phone,
  CreditCard,
  Calendar,
  CheckCircle2,
  Truck,
  XCircle,
  MessageSquare,
  MapPin,
  Clock,
  ExternalLink,
  ChevronRight,
  ShoppingBag
} from "lucide-react";
import api from "../../api/api";
import { motion } from "framer-motion";
import nicePrompt from "../../components/UI/NicePrompt";

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();

    // 🔌 Socket Listener for Real-time Updates
    const handleOrderUpdate = (data) => {
      console.log("🔌 SOCKET: Order update received in Detail page:", data);
      if (data.orderId === id) {
        fetchOrder(); // Refetch to get full data and status
      }
    };

    if (window.zepofySocket) {
      window.zepofySocket.on('order_updated', handleOrderUpdate);
    }

    return () => {
      if (window.zepofySocket) {
        window.zepofySocket.off('order_updated', handleOrderUpdate);
      }
    };
  }, [id]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/commerce/orders/${id}`);
      if (res.data.success) {
        setOrder(res.data.order);
      }
    } catch (err) {
      console.error(err);
      nicePrompt.error("Error", "Failed to fetch order details");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status) => {
    try {
      const res = await api.patch(`/commerce/orders/${id}/status`, { status });
      if (res.data.success) {
        nicePrompt.success("Status Updated", `Order marked as ${status}`);
        setOrder({ ...order, status });
      }
    } catch (err) {
      nicePrompt.error("Error", "Failed to update status");
    }
  };

  const handleOpenChat = () => {
    if (order?.customerPhone) {
      const phone = order.customerPhone.replace(/\D/g, "");
      navigate(`/messages?phone=${phone}`);
    }
  };

  const handleCall = () => {
    if (order?.customerPhone) {
      window.location.href = `tel:${order.customerPhone}`;
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "pending": return "bg-amber-100 text-amber-600 border-amber-200";
      case "confirmed": return "bg-blue-100 text-blue-600 border-blue-200";
      case "paid": return "bg-emerald-100 text-emerald-600 border-emerald-200";
      case "shipped": return "bg-indigo-100 text-indigo-600 border-indigo-200";
      case "delivered": return "bg-slate-100 text-slate-600 border-slate-200";
      case "cancelled": return "bg-red-100 text-red-600 border-red-200";
      default: return "bg-slate-100 text-slate-400 border-slate-200";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-bold animate-pulse">Loading Order Details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
        <div className="bg-white p-12 rounded-[40px] shadow-xl border border-slate-100 text-center max-w-md w-full">
          <XCircle size={64} className="text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">Order Not Found</h2>
          <p className="text-slate-500 font-medium mb-8 text-sm">We couldn't find the order you're looking for. It might have been deleted.</p>
          <button
            onClick={() => navigate("/commerce/orders")}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-poppins pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto px-6 md:px-10 h-24 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate("/commerce/orders")}
              className="w-12 h-12 rounded-2xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Order #{order._id.toString().slice(-6).toUpperCase()}</h1>
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-widest ${getStatusStyle(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Placed on {new Date(order.createdAt).toLocaleString()}</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-3">
            <button 
              onClick={handleOpenChat}
              className="px-6 py-3 bg-blue-50 text-blue-600 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-blue-100 transition-all active:scale-95"
            >
              <MessageSquare size={18} /> Open Chat
            </button>
            <button 
              onClick={handleCall}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95"
            >
              <Phone size={18} /> Call Now
            </button>
          </div>
        </div>
      </div>

      {/* Cancellation Notice */}
      {order.status === 'cancelled' && (
        <div className="bg-rose-50 border-b border-rose-100 py-3">
          <div className="max-w-[1440px] mx-auto px-6 md:px-10 flex items-center gap-3 text-rose-600 font-bold text-sm">
            <XCircle size={18} />
            This order has been cancelled and will not be processed.
          </div>
        </div>
      )}

      <div className="max-w-[1440px] mx-auto px-6 md:px-10 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Details */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Products Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                  <Package className="text-blue-600" /> Order Items ({order.items?.length})
                </h2>
                <div className="px-4 py-2 bg-slate-50 rounded-2xl text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Shipment Group #1
                </div>
              </div>

              <div className="p-8">
                <div className="space-y-6">
                  {order.items?.map((item, i) => (
                    <div key={i} className="flex items-center gap-6 group">
                      <div className="w-24 h-24 bg-slate-50 rounded-[32px] border border-slate-100 overflow-hidden flex items-center justify-center p-2 group-hover:scale-105 transition-transform">
                        {item.productId?.imageUrl ? (
                          <img src={item.productId.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                          <ShoppingBag size={32} className="text-slate-200" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight leading-tight">{item.name}</h3>
                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">SKU: {item.productId?.sku || "N/A"}</p>
                          </div>
                          <p className="text-lg font-black text-slate-900 tracking-tight">₹{(item.price * item.quantity).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-6 mt-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quantity:</span>
                            <span className="px-3 py-1 bg-slate-50 rounded-lg text-sm font-black text-slate-800">{item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unit Price:</span>
                            <span className="text-sm font-bold text-slate-500">₹{item.price.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bill Summary */}
                <div className="mt-10 pt-10 border-t border-slate-50 space-y-4">
                  <div className="flex justify-between items-center text-sm font-bold text-slate-500 uppercase tracking-widest">
                    <span>Subtotal</span>
                    <span className="text-slate-900">₹{order.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-slate-500 uppercase tracking-widest">
                    <span>Shipping</span>
                    <span className="text-emerald-500">FREE</span>
                  </div>
                  <div className="flex justify-between items-center text-2xl font-black pt-6 border-t border-slate-100">
                    <span className="text-slate-900 tracking-tighter">Grand Total</span>
                    <span className="text-blue-600">₹{order.totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Actions Bar */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100"
            >
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 ml-2">Execution Pipeline</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button 
                  onClick={() => updateStatus('confirmed')}
                  className={`py-5 rounded-[28px] font-black text-[10px] flex flex-col items-center gap-2 transition-all border shadow-sm uppercase tracking-widest ${order.status === 'confirmed' ? 'bg-blue-600 text-white border-blue-600 shadow-blue-100' : 'bg-white text-slate-600 hover:bg-blue-50 border-slate-100'}`}
                >
                  <CheckCircle2 size={20} /> Confirm
                </button>
                <button 
                  onClick={() => updateStatus('shipped')}
                  className={`py-5 rounded-[28px] font-black text-[10px] flex flex-col items-center gap-2 transition-all border shadow-sm uppercase tracking-widest ${order.status === 'shipped' ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100' : 'bg-white text-slate-600 hover:bg-indigo-50 border-slate-100'}`}
                >
                  <Truck size={20} /> Shipped
                </button>
                <button 
                  onClick={() => updateStatus('delivered')}
                  className={`py-5 rounded-[28px] font-black text-[10px] flex flex-col items-center gap-2 transition-all border shadow-sm uppercase tracking-widest ${order.status === 'delivered' ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-100' : 'bg-white text-slate-600 hover:bg-emerald-50 border-slate-100'}`}
                >
                  <CheckCircle2 size={20} /> Delivered
                </button>
                <button 
                  onClick={() => updateStatus('cancelled')}
                  className={`py-5 rounded-[28px] font-black text-[10px] flex flex-col items-center gap-2 transition-all border shadow-sm uppercase tracking-widest ${order.status === 'cancelled' ? 'bg-red-600 text-white border-red-600 shadow-red-100' : 'bg-white text-slate-600 hover:bg-red-50 border-slate-100'}`}
                >
                  <XCircle size={20} /> Cancel
                </button>
              </div>
            </motion.div>
          </div>

          {/* Sidebar Info */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Customer Info */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-[24px] bg-blue-600 text-white flex items-center justify-center font-black text-2xl shadow-xl shadow-blue-100">
                  {order.customerName?.[0]}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">{order.customerName}</h3>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Verified Customer</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</p>
                    <p className="font-bold text-slate-800">{order.customerPhone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Method</p>
                    <p className="font-bold text-slate-800 uppercase">{order.paymentMethod || "COD"} | {order.paymentStatus || "UNPAID"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Address</p>
                    <p className="font-bold text-slate-800 text-sm leading-relaxed uppercase">{order.address || "No address provided"}</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-slate-50 space-y-3">
                <button 
                  onClick={handleOpenChat}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all active:scale-95 uppercase tracking-widest"
                >
                  <MessageSquare size={18} fill="white" /> WhatsApp Chat
                </button>
              </div>
            </motion.div>

            {/* Timeline */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100"
            >
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-3 tracking-tight mb-8">
                <Clock className="text-indigo-600" /> Order Timeline
              </h3>
              <div className="space-y-8 relative before:content-[''] before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                <div className="relative pl-12">
                  <div className="absolute left-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 border-4 border-white shadow-sm">
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="text-sm font-black text-slate-900 tracking-tight">Order Created</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
                <div className="relative pl-12">
                  <div className={`absolute left-0 w-10 h-10 ${order.status !== 'pending' ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-300'} rounded-full flex items-center justify-center border-4 border-white shadow-sm`}>
                    <CheckCircle2 size={20} />
                  </div>
                  <p className={`text-sm font-black tracking-tight ${order.status !== 'pending' ? 'text-slate-900' : 'text-slate-300'}`}>Confirmed</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Automation Ready</p>
                </div>
                <div className="relative pl-12 opacity-50">
                  <div className="absolute left-0 w-10 h-10 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                    <Truck size={20} />
                  </div>
                  <p className="text-sm font-black text-slate-300 tracking-tight">In Transit</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Waiting for pickup</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
