import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  Package, 
  TrendingUp, 
  Zap, 
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  Users
} from "lucide-react";
import api from "../../api/api";
import { motion } from "framer-motion";

export default function CommerceDashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    conversionRate: 0,
    recentOrders: [],
    syncStatus: "Connected",
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [pRes, oRes] = await Promise.all([
        api.get("/commerce/products"),
        api.get("/commerce/orders")
      ]);
      
      const orders = oRes.data.orders || [];
      const revenue = orders.reduce((acc, curr) => acc + curr.totalAmount, 0);

      setStats({
        totalProducts: pRes.data.products?.length || 0,
        totalOrders: orders.length,
        conversionRate: orders.length > 0 ? ((orders.length / 100) * 100).toFixed(1) : 0, // Mocked denom
        recentOrders: orders.slice(0, 5),
        syncStatus: "Connected",
        totalRevenue: revenue
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: "Total Revenue", value: `₹${stats.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "blue", trend: "+12.5%" },
    { label: "Total Orders", value: stats.totalOrders, icon: ShoppingBag, color: "emerald", trend: "+8.2%" },
    { label: "Products", value: stats.totalProducts, icon: Package, color: "indigo", trend: "+2 new" },
    { label: "Conversion", value: `${stats.conversionRate}%`, icon: Zap, color: "amber", trend: "-1.5%" },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 bg-[#F8FAFC] min-h-screen font-poppins">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Store Dashboard</h1>
          <p className="text-slate-500 mt-1 font-medium">Overview of your WhatsApp Commerce performance</p>
        </div>
        <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl text-xs font-bold border border-emerald-100 flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Meta Catalog Sync: Active
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white rounded-3xl animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {statCards.map((stat, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={i} 
                className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-50/50 transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                   <div className={`p-3 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600`}>
                      <stat.icon size={24} />
                   </div>
                   <span className={`text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-0.5 ${stat.trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {stat.trend.startsWith('+') ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {stat.trend}
                   </span>
                </div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                   <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-900">Recent Orders</h3>
                      <button className="text-blue-600 text-sm font-bold hover:underline">View All</button>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left">
                         <tbody className="divide-y divide-slate-50">
                            {stats.recentOrders.map(order => (
                               <tr key={order._id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-8 py-5">
                                     <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center font-bold text-blue-600 border border-slate-100">{order.customerName[0]}</div>
                                        <div>
                                           <p className="text-sm font-bold text-slate-800">{order.customerName}</p>
                                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{order.customerPhone}</p>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-8 py-5 text-center">
                                     <span className="text-xs font-bold text-slate-600">{order.items?.length || 0} Items</span>
                                  </td>
                                  <td className="px-8 py-5 text-center">
                                     <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">{order.status}</span>
                                  </td>
                                  <td className="px-8 py-5 text-right font-black text-slate-900">₹{order.totalAmount.toLocaleString()}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>

             <div className="lg:col-span-1 space-y-6">
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[32px] shadow-xl text-white relative overflow-hidden">
                   <div className="relative z-10 space-y-6">
                      <div className="flex items-center gap-3 opacity-80 uppercase tracking-widest text-[10px] font-black">
                         <TrendingUp size={16} /> Automation Performance
                      </div>
                      <div className="space-y-1">
                         <p className="text-4xl font-black">84%</p>
                         <p className="text-xs font-medium text-white/60 uppercase tracking-wide">Flow Efficiency</p>
                      </div>
                      <div className="pt-4 flex items-center justify-between">
                         <div className="text-center">
                            <p className="text-xl font-bold">128</p>
                            <p className="text-[10px] font-medium opacity-60">Interactions</p>
                         </div>
                         <div className="text-center border-l border-white/10 pl-6">
                            <p className="text-xl font-bold">14</p>
                            <p className="text-[10px] font-medium opacity-60">Conversions</p>
                         </div>
                      </div>
                   </div>
                   <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                </div>

                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                   <h3 className="text-lg font-bold text-slate-900 border-b border-slate-50 pb-4">Activity Stream</h3>
                   <div className="space-y-6 pt-2">
                      {[
                        { time: '2m ago', msg: 'New order from +91 98765...', icon: ShoppingBag, color: 'blue' },
                        { time: '1h ago', msg: 'Catalog synced successfully', icon: Zap, color: 'emerald' },
                        { time: '3h ago', msg: 'Customer viewed catalog', icon: Users, color: 'indigo' },
                      ].map((activity, i) => (
                        <div key={i} className="flex gap-4">
                           <div className={`w-8 h-8 rounded-xl bg-${activity.color}-50 text-${activity.color}-600 flex items-center justify-center shrink-0`}>
                              <activity.icon size={16} />
                           </div>
                           <div className="flex-1">
                              <p className="text-sm font-bold text-slate-800 leading-tight">{activity.msg}</p>
                              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight flex items-center gap-1"><Clock size={10} /> {activity.time}</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        </>
      )}
    </div>
  );
}
