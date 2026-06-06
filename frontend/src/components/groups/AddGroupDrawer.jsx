import { useState, useEffect, useMemo } from "react";
import api from "../../api/api";
import { FiX, FiSearch, FiUserPlus, FiUsers, FiCheckCircle } from "react-icons/fi";

export default function AddGroupDrawer({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false); // 🔥 NEW: Global select state
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1); // 🔥 NEW: Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  
  // New contact form state
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [creatingContact, setCreatingContact] = useState(false);

  /* ================= LOAD CONTACTS ================= */
  useEffect(() => {
    loadContacts(1, true);
  }, [search]);

  const loadContacts = async (p = 1, reset = false) => {
    if (loading) return;
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

  /* ================= SEARCH FILTER ================= */
  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    return contacts.filter((c) =>
      `${c.name} ${c.phone}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [contacts, search]);

  /* ================= TOGGLE SINGLE ================= */
  const toggle = (id) => {
    const s = new Set(selected);
    if (s.has(id)) {
      s.delete(id);
      setIsAllSelected(false);
    } else {
      s.add(id);
    }
    setSelected(s);
  };

  /* ================= SELECT ALL ================= */
  const toggleAll = () => {
    if (isAllSelected || selected.size === contacts.length) {
      setSelected(new Set());
      setIsAllSelected(false);
    } else {
      if (total > contacts.length) {
        setIsAllSelected(true);
        setSelected(new Set(contacts.map(c => c._id)));
      } else {
        setSelected(new Set(contacts.map(c => c._id)));
        setIsAllSelected(false);
      }
    }
  };

  const allSelected = isAllSelected || (total > 0 && selected.size === total);

  /* ================= CREATE NEW CONTACT ================= */
  const createNewContact = async () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      alert("Name and phone number are required");
      return;
    }

    setCreatingContact(true);
    try {
      const res = await api.post("/contacts", {
        name: newContact.name.trim(),
        phone: newContact.phone.trim()
      });

      if (res.data.success) {
        const createdContact = res.data.contact;
        
        // Add to contacts list
        setContacts(prev => [createdContact, ...prev]);
        
        // Auto-select the new contact
        setSelected(prev => {
          const s = new Set(prev);
          s.add(createdContact._id);
          return s;
        });
        
        // Reset form and hide
        setNewContact({ name: "", phone: "" });
        setShowAddContact(false);
        
        // Clear search to show the new contact
        setSearch("");
      }
    } catch (err) {
      console.error("Failed to create contact:", err);
      alert(err.response?.data?.error || "Failed to create contact");
    } finally {
      setCreatingContact(false);
    }
  };

  /* ================= CREATE GROUP ================= */
  const create = async () => {
    if (!name.trim()) return alert("Group name required");
    await api.post("/groups/create-with-contacts", {
      groupName: name,
      contactIds: isAllSelected ? [] : [...selected],
      selectAll: isAllSelected,
      filters: { search }
    });
    onCreated();
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
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Create New Group</h2>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Organize your contacts for campaigns</p>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm transition-all text-slate-400 hover:text-slate-600 hover:scale-105 active:scale-95">
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Group Name */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Group Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Premium Customers"
              className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none text-[13px] font-bold text-slate-700 bg-slate-50/50 hover:bg-white transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:font-medium"
            />
          </div>

          {/* Search & Selection Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Select Contacts</label>
               <button
                  onClick={() => setShowAddContact(!showAddContact)}
                  className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${showAddContact ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
               >
                  {showAddContact ? <FiX size={14} /> : <FiUserPlus size={14} />}
                  {showAddContact ? 'Cancel' : 'Quick Add Contact'}
               </button>
            </div>

            {/* Quick Add Form */}
            {showAddContact && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5 block">Full Name</label>
                    <input
                      value={newContact.name}
                      onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Name"
                      className="w-full rounded-xl border border-blue-100 px-4 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-blue-400 bg-white"
                      disabled={creatingContact}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5 block">Phone Number</label>
                    <input
                      value={newContact.phone}
                      onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Phone"
                      className="w-full rounded-xl border border-blue-100 px-4 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-blue-400 bg-white"
                      disabled={creatingContact}
                    />
                  </div>
                </div>
                <button
                  onClick={createNewContact}
                  disabled={creatingContact || !newContact.name.trim() || !newContact.phone.trim()}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider hover:bg-black transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {creatingContact ? "Adding..." : "Add & Select Contact"}
                </button>
              </div>
            )}

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

            {/* Selection Stats */}
            <div className="flex items-center justify-between px-2">
               <button
                  onClick={toggleAll}
                  className="text-[11px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 flex items-center gap-2"
               >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${allSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                     {allSelected && <FiCheckCircle className="text-white w-3 h-3" />}
                  </div>
                  {allSelected ? 'Deselect All' : 'Select All'}
               </button>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  {isAllSelected ? `${total} (All)` : selected.size} Contacts Selected
               </span>
            </div>

            {/* Contacts List */}
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
                      <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selected.has(c._id) ? 'bg-blue-600 border-blue-600' : 'border-slate-200 bg-white group-hover:border-blue-200'}`}>
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
            This group will be available for all future campaigns
          </p>
          <div className="flex gap-3">
             <button
               onClick={onClose}
               className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
             >
               Cancel
             </button>
             <button
               onClick={create}
               disabled={!name.trim()}
               className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl text-[13px] font-bold uppercase tracking-wider hover:bg-black transition-all shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50"
             >
               Create Group
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

