import React, { useEffect, useState, useCallback } from "react";
import api from "../api/api";
import AddGroupDrawer from "../components/groups/AddGroupDrawer";
import EditGroupModal from "../components/groups/EditGroupModal";
import GroupContacts from "../components/GroupContacts";
import Modal from "../components/UI/Modal";
import DensitySelector from "../components/UI/DensitySelector";
import nicePrompt from "../components/UI/NicePrompt";
import {
  Users,
  Plus,
  Eye,
  SquarePen,
  Trash2,
  Folder,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X
} from 'lucide-react';
import { cn } from "../utils/cn";


export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [openAdd, setOpenAdd] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const loadGroups = useCallback(async (p = page, l = limit) => {
    try {
      const res = await api.get("/contact-groups", {
        params: { search, page: p, limit: l }
      });
      setGroups(res.data.groups || []);
      setTotal(res.data.total || (res.data.groups?.length || 0));
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  }, [search, page, limit]);

  useEffect(() => {
    setPage(1);
    loadGroups(1, limit);
  }, [search, limit]);

  useEffect(() => {
    loadGroups(page, limit);
  }, [page]);

  const del = async (id) => {
    const confirmed = await nicePrompt.confirm("Delete Group", "Are you sure you want to permanently delete this group hub?", "danger");
    if (!confirmed) return;
    try {
      await api.delete(`/contact-groups/${id}`);
      loadGroups();
      nicePrompt.success("Group Removed", "The contact hub has been deleted.");
    } catch (err) {
      nicePrompt.error("Delete Failed", err.response?.data?.error || "We couldn't remove the group at this time.");
    }
  };

  return (
    <>
      <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden font-poppins">
        {/* Page Header */}
        <div className="px-5 pt-4 pb-6 shrink-0 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
              <input
                type="text"
                placeholder="Search group hubs by label or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-10 pr-4 bg-white border border-slate-200/60 rounded-lg text-xs font-medium text-slate-600 focus:border-blue-500 transition-all outline-none shadow-sm shadow-slate-200/10"
              />
            </div>
            <button
              onClick={() => setOpenAdd(true)}
              className="h-9 px-4 bg-blue-600 hover:bg-black text-white font-bold text-[11px] uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 active:scale-95 group shadow-sm"
            >
              <Plus size={14} strokeWidth={3} />
              <span>Create Group Hub</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden px-6 pb-6">
          {groups.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-12 text-center relative overflow-hidden">
              <div className="w-20 h-20 bg-blue-50/50 rounded-2xl flex items-center justify-center mb-6 border border-blue-100 shadow-sm">
                <Users className="w-10 h-10 text-blue-500/80" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">No Active Hubs Found</h3>
              <p className="text-slate-400 max-w-sm mx-auto font-medium text-sm leading-relaxed mb-8">
                Create your first contact group hub to start orchestrating sophisticated WhatsApp campaigns and automated workflows.
              </p>
              <button
                onClick={() => setOpenAdd(true)}
                className="btn-compact bg-blue-600 text-white hover:bg-black shadow-lg shadow-blue-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Initialize First Hub</span>
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden relative">
              <div className="relative z-10 flex flex-col h-full">
              {/* Table Header Controls */}
              <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/30 shrink-0 uppercase">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">Contact Groups Hierarchy</div>
                </div>
                <div className="flex items-center gap-3">
                  <DensitySelector
                    value={limit}
                    onChange={(val) => {
                      setLimit(val);
                      setPage(1);
                    }}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50/80 backdrop-blur-sm shadow-sm ring-1 ring-slate-200/20">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60 text-left">Group Identity</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center border-b border-slate-200/60">Classification</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center border-b border-slate-200/60">Audience Size</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center border-b border-slate-200/60">Entry Date</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right border-b border-slate-200/60 pr-8">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {groups.map((group) => (
                      <tr
                        key={group._id}
                        onClick={() => setSelectedGroup(group)}
                        className="hover:bg-blue-50/20 transition-all duration-300 group cursor-pointer"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50/50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm transition-transform group-hover:scale-110">
                              <Folder className="w-5 h-5" strokeWidth={2.5} />
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 text-sm truncate group-hover:text-blue-700 transition-colors">{group.name}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5 group-hover:text-blue-400 transition-colors">ID_{group._id.slice(-8).toUpperCase()}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100/50 shadow-sm">
                            <Users className="w-3 h-3" strokeWidth={3} />
                            Active Hub
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-slate-800 text-sm tracking-tight">{group.membersCount || 0}</span>
                            <span className="font-black text-slate-400 text-[9px] uppercase tracking-widest mt-1 opacity-60">Profiles</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-sm tracking-tight">
                              {group.createdAt ? new Date(group.createdAt).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              }) : '—'}
                            </span>
                            <span className="font-black text-slate-400 text-[9px] uppercase tracking-widest mt-1 opacity-60">Created</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 pr-8">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedGroup(group); }}
                              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100 shadow-sm hover:shadow-md"
                              title="Inspect Audience"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingGroup(group); }}
                              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-transparent hover:border-indigo-100 shadow-sm hover:shadow-md"
                              title="Configure Hub"
                            >
                              <SquarePen className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); del(group._id); }}
                              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 shadow-sm hover:shadow-md"
                              title="Purge Hub"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between shrink-0 mb-0 rounded-b-2xl">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Viewing <span className="text-blue-600 font-bold">{total === 0 ? 0 : ((page - 1) * limit) + 1}-{Math.min(page * limit, total)}</span> of {total} Contact Hubs
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-blue-600 hover:border-blue-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="px-3 h-8 flex items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-[11px] font-bold text-blue-600">
                    {page}
                  </div>
                  <button
                    disabled={page * limit >= total}
                    onClick={() => setPage(page + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-blue-600 hover:border-blue-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* SELECTED GROUP CONTACTS MODAL */}
        {selectedGroup && (
          <GroupContacts
            group={selectedGroup}
            onClose={() => setSelectedGroup(null)}
            onUpdated={loadGroups}
          />
        )}

        {/* DRAWER */}
        {openAdd && (
          <AddGroupDrawer
            onClose={() => setOpenAdd(false)}
            onCreated={loadGroups}
          />
        )}

        {/* EDIT MODAL */}
        {editingGroup && (
          <EditGroupModal
            group={editingGroup}
            onClose={() => setEditingGroup(null)}
            onUpdated={loadGroups}
          />
        )}
      </div>
    </>
  );
}
