import { useState, useEffect } from "react";
import api from "../../api/api";
import { FiX, FiCheckCircle, FiUsers, FiSearch } from "react-icons/fi";

export default function EditGroupModal({ group, onClose, onUpdated }) {
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setName(group?.name || "");
    setSelected(new Set(group?.contactIds || []));
  }, [group]);

  useEffect(() => {
    loadContacts(1, true);
  }, [search]);

  const loadContacts = async (p = 1, reset = false) => {
    setLoading(true);
    try {
      const res = await api.get("/contacts", { params: { page: p, limit: 50, search } });
      const newContacts = res.data.contacts || [];
      if (reset) {
        setContacts(newContacts);
      } else {
        setContacts(prev => [...prev, ...newContacts]);
      }
      setTotal(res.data.total || 0);
      setHasMore(newContacts.length === 50);
      setPage(p);
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      contacts.forEach(c => next.add(c._id));
      return next;
    });
  };

  const deselectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      contacts.forEach(c => next.delete(c._id));
      return next;
    });
  };

  const update = async () => {
    if (!name.trim()) {
      alert("Group name required");
      return;
    }

    await api.put(`/contact-groups/${group._id}`, {
      name: name.trim(),
      contactIds: Array.from(selected),
    });

    onUpdated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-xl rounded-[28px] shadow-2xl border border-slate-200/60 animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight heading-font">Edit Group</h2>
            <p className="text-[12px] text-slate-500 font-bold uppercase tracking-wide mt-1">Modify group name and member list</p>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm transition-all text-slate-400 hover:text-slate-600 hover:scale-105 active:scale-95">
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Group Name */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Group Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Premium Customers"
              className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none text-[13px] font-bold text-slate-700 bg-slate-50/50 hover:bg-white transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
            />
          </div>

          {/* Contact List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Manage members ({selected.size} selected)</label>
               <div className="flex items-center gap-3">
                 <button
                   type="button"
                   onClick={selectAll}
                   className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider transition-colors"
                 >
                   Select All
                 </button>
                 <span className="text-[10px] text-slate-300">|</span>
                 <button
                   type="button"
                   onClick={deselectAll}
                   className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider transition-colors"
                 >
                   Deselect All
                 </button>
               </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone..."
                className="w-full rounded-xl border border-slate-200 pl-11 pr-4 py-3 outline-none text-[12px] font-bold text-slate-700 bg-slate-50/50 hover:bg-white transition-all focus:border-blue-500"
              />
            </div>

            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30 h-[300px] overflow-y-auto custom-scrollbar relative">
              {(loading && page === 1) ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-slate-50/30">
                  <div className="w-6 h-6 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Contacts...</span>
                </div>
              ) : contacts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                   <FiUsers className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                   <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 italic">No contacts found</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {contacts.map((c) => (
                    <div
                      key={c._id}
                      onClick={() => toggle(c._id)}
                      className="flex items-center gap-4 px-6 py-3.5 hover:bg-blue-50/40 transition-all cursor-pointer group"
                    >
                      <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selected.has(c._id) ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-500/10' : 'border-slate-200 bg-white group-hover:border-blue-200'}`}>
                        {selected.has(c._id) && <FiCheckCircle className="text-white w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-slate-700 leading-none mb-1">{c.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">{c.phone}</p>
                      </div>
                    </div>
                  ))}

                  {hasMore && (
                    <div className="p-2">
                      <button
                        onClick={() => loadContacts(page + 1)}
                        disabled={loading}
                        className="w-full py-4 bg-white border border-slate-100 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading && <div className="w-3 h-3 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />}
                        {loading ? "Loading more..." : "Load More Contacts"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[200px]">
            Updating this group will reflect in all ongoing campaigns
          </p>
          <div className="flex gap-3">
             <button
               onClick={onClose}
               className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
             >
               Cancel
             </button>
             <button
               onClick={update}
               disabled={!name.trim()}
               className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl text-[13px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-95 disabled:opacity-50"
             >
               Update Group
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

