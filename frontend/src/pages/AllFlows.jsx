import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { 
  GitBranch, 
  Plus, 
  Search, 
  Eye, 
  Trash2, 
  Clock, 
  Activity,
  Layers,
  ChevronRight
} from 'lucide-react';

export default function AllFlows() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const loadFlows = async () => {
    try {
      setLoading(true);
      const res = await api.get("/flows");
      setFlows(res.data.flows || []);
    } catch (err) {
      console.error("Failed to load flows:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlows();
  }, []);

  const deleteFlow = async (id) => {
    if (!window.confirm("Delete this automation flow? This cannot be undone.")) return;
    try {
      await api.delete(`/flows/${id}`);
      loadFlows();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const filteredFlows = flows.filter(f => 
    f.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden font-poppins selection:bg-blue-100">
      {/* Header Section */}
      <div className="px-6 py-6 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Search automation flows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-blue-500/50 transition-all outline-none placeholder:text-slate-300"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black tracking-widest border border-blue-100/50 shadow-sm uppercase">
              <Activity size={12} className="animate-pulse" /> {flows.length} Active Automations
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/flows/new")}
              className="h-11 px-6 flex items-center gap-2 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <Plus size={16} strokeWidth={3} />
              Design New Flow
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="h-full bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50/80 backdrop-blur-sm shadow-sm ring-1 ring-slate-200/20">
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60 w-[40%] text-left">Flow Identity</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60 text-center w-[20%]">Complexity</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60 text-center w-[20%]">Status</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60 text-right pr-8 w-[20%]">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan="4" className="px-6 py-6"><div className="h-4 bg-slate-50 rounded-lg w-full" /></td>
                    </tr>
                  ))
                ) : filteredFlows.length > 0 ? (
                  filteredFlows.map((f) => (
                    <tr key={f._id} className="hover:bg-blue-50/20 transition-all duration-300 group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                            <GitBranch className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-[14px] group-hover:text-blue-600 transition-colors">{f.name}</div>
                            <div className="font-black text-slate-400 text-[9px] mt-0.5 uppercase tracking-widest opacity-60">ID_{f._id.slice(-8).toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-slate-800 text-sm tracking-tight">{f.nodes?.length || 0}</span>
                          <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider mt-0.5">Logic Nodes</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100/50">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Operational
                        </span>
                      </td>
                      <td className="px-6 py-5 pr-8">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/flows/edit/${f._id}`)}
                            className="h-9 px-4 flex items-center gap-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm active:scale-95"
                          >
                            <Eye size={14} /> Open
                          </button>
                          <button
                            onClick={() => deleteFlow(f._id)}
                            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 shadow-sm active:scale-95"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 text-slate-300">
                          <Layers size={32} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No automation flows detected</p>
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest opacity-60">Design your first automated logic sequence today.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer - Consistency */}
          <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Automated Operations Registry • Page <span className="text-blue-600">01</span>
            </div>
            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
              Total {filteredFlows.length} Logic Flows Found
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

