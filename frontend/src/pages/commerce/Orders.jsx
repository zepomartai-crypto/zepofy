import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Filter,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  Eye,
  CreditCard,
  Phone,
  User,
  ExternalLink,
  MessageSquare,
  RefreshCw
} from "lucide-react";
import api from "../../api/api";
import { motion, AnimatePresence } from "framer-motion";
import nicePrompt from "../../components/UI/NicePrompt";
import DensitySelector from "../../components/UI/DensitySelector";

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  useEffect(() => {
    fetchOrders(page);

    // 🔌 Socket Listeners
    if (window.zepofySocket) {
      window.zepofySocket.on("new_order", (data) => {
        console.log("🛒 Socket: New order received!", data);
        nicePrompt.info("New Order", `New order from ${data.customer || 'Customer'}!`);
        fetchOrders(1);
      });

      window.zepofySocket.on("order_status_updated", (data) => {
        console.log("🛒 Socket: Order status updated!", data);
        setOrders(prev => prev.map(o => o._id === data.orderId ? { ...o, status: data.status } : o));
        if (selectedOrder?._id === data.orderId) {
          setSelectedOrder(prev => ({ ...prev, status: data.status }));
        }
      });

      window.zepofySocket.on("order_deleted", (data) => {
        setOrders(prev => prev.filter(o => o._id !== data.orderId));
        if (selectedOrder?._id === data.orderId) setSelectedOrder(null);
      });
    }

    return () => {
      if (window.zepofySocket) {
        window.zepofySocket.off("new_order");
        window.zepofySocket.off("order_status_updated");
        window.zepofySocket.off("order_deleted");
      }
    };
  }, [page, selectedOrder]);

  const fetchOrders = async (p = 1) => {
    try {
      setLoading(true);
      const res = await api.get(`/commerce/orders?page=${p}&limit=10`);
      setOrders(res.data.orders || []);
      setTotalPages(res.data.pagination?.pages || 1);
      setTotalOrders(res.data.pagination?.total || 0);
    } catch (err) {
      console.error(err);
      nicePrompt.error("Error", "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const res = await api.patch(`/commerce/orders/${id}/status`, { status });
      if (res.data.success) {
        nicePrompt.success("Status Updated", `Order marked as ${status}`);
        // Socket will handle local state update if connected, but fallback to manual update
        setOrders(prev => prev.map(o => o._id === id ? { ...o, status } : o));
        if (selectedOrder?._id === id) {
          setSelectedOrder(prev => ({ ...prev, status }));
        }
      }
    } catch (err) {
      nicePrompt.error("Error", "Failed to update status");
    }
  };

  const deleteOrder = async (id) => {
    if (!window.confirm("Are you sure you want to delete this order? This action cannot be undone.")) return;
    try {
      await api.delete(`/commerce/orders/${id}`);
      nicePrompt.success("Deleted", "Order removed successfully");
      setOrders(prev => prev.filter(o => o._id !== id));
      if (selectedOrder?._id === id) setSelectedOrder(null);
    } catch (err) {
      nicePrompt.error("Error", "Failed to delete order");
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-600 border-amber-200';
      case 'confirmed': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'paid': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'delivered': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'cancelled': return 'bg-red-100 text-red-600 border-red-200';
      default: return 'bg-slate-100 text-slate-400 border-slate-200';
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.customerName.toLowerCase().includes(search.toLowerCase()) || o.customerPhone.includes(search);
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    revenue: orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0)
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-[#F8FAFC] min-h-screen font-poppins pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ShoppingBag className="text-blue-600" /> WhatsApp Orders
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Capture and fulfill orders from your automated flows</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Volume", value: stats.total, icon: ShoppingBag, color: "blue" },
          { label: "Awaiting Action", value: stats.pending, icon: Clock, color: "amber" },
          { label: "Confirmed", value: stats.confirmed, icon: CheckCircle2, color: "emerald" },
          { label: "Total Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: CreditCard, color: "indigo" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by customer or phone..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-100"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <DensitySelector
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={[
                { label: "All Status", value: "all" },
                { label: "Pending", value: "pending" },
                { label: "Confirmed", value: "confirmed" },
                { label: "Paid", value: "paid" },
                { label: "Shipped", value: "shipped" },
                { label: "Delivered", value: "delivered" },
                { label: "Cancelled", value: "cancelled" }
              ]}
              label="Density:"
            />
            <button
              onClick={fetchOrders}
              className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-blue-600 hover:bg-blue-50 transition-all"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] leading-loose">Customer</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] text-center">Items</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] text-center">Amount</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] text-center">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] text-center">Date</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [1, 2, 3].map(i => <tr key={i} className="animate-pulse h-20 bg-slate-50/10"><td colSpan={6}></td></tr>)
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center opacity-40">
                    <ShoppingBag size={48} className="mx-auto mb-4" />
                    <p className="font-bold">No orders yet</p>
                  </td>
                </tr>
              ) : filteredOrders.map((order, i) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={order._id} 
                  className="hover:bg-blue-50/30 transition-all cursor-pointer group border-b border-slate-50 last:border-0" 
                  onClick={() => navigate(`/commerce/orders/${order._id}`)}
                >
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-blue-100">
                        {order.customerName[0]}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">{order.customerName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5 uppercase tracking-wider">
                            <Phone size={10} /> {order.customerPhone}
                          </p>
                          {order.source === 'whatsapp' && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded-md text-[8px] font-black uppercase tracking-tighter">Verified WABA</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col items-center">
                      <div className="flex -space-x-3 overflow-hidden">
                        {order.items?.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="w-10 h-10 rounded-xl bg-white border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                            {item.productId?.imageUrl ? (
                              <img src={item.productId.imageUrl} alt="P" className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag size={16} className="text-slate-200" />
                            )}
                          </div>
                        ))}
                        {order.items?.length > 3 && (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-black text-slate-400">
                            +{order.items.length - 3}
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mt-1.5">{order.items?.length || 0} ITEMS</p>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className="text-base font-black text-slate-900 tracking-tight">₹{order.totalAmount.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black border ${getStatusStyle(order.status)} uppercase tracking-[0.1em] shadow-sm`}>
                        {order.status}
                      </span>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                        {order.paymentMethod === 'online' ? '💳 Digital' : '🚚 COD'} • {order.paymentStatus || 'UNPAID'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="flex flex-col items-center">
                      <p className="text-xs font-black text-slate-900 tracking-tight">{new Date(order.createdAt).toLocaleDateString()}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigate(`/commerce/orders/${order._id}`); }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteOrder(order._id); }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                        title="Delete Order"
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-8 py-5 border-t border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Orders Registry • Viewing <span className="text-blue-600 font-bold">{page}</span> of <span className="text-slate-600">{totalPages}</span>
            </div>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
              >
                Prev
              </button>
              
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={`w-8 h-8 rounded-lg text-[11px] font-semibold transition-all ${page === i + 1 ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:text-slate-900 cursor-pointer"}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
