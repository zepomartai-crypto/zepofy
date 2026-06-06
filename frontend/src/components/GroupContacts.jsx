import { useEffect, useState, useRef } from "react";
import api from "../api/api";
import { UserMinus, Phone, Mail, UserPlus, Search, X, Plus, Users, Loader2, Trash2 } from "lucide-react";

export default function GroupContacts({ group, onClose, onUpdated }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());

  // Quick Add Member State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [addingMember, setAddingMember] = useState(null);
  const [memberSearch, setMemberSearch] = useState("");
  const resultsRef = useRef(null);

  /* ================= LOAD GROUP CONTACTS ================= */
  useEffect(() => {
    if (!group?._id) return;

    const loadGroupContacts = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/contact-groups/${group._id}`);
        setContacts(res.data.group?.members || []);
      } catch (err) {
        console.error("Failed to load group contacts", err);
        setContacts([]);
      } finally {
        setLoading(false);
      }
    };

    loadGroupContacts();
  }, [group]);

  /* ================= SEARCH CONTACTS ================= */
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        const res = await api.get("/contacts", { params: { search: searchQuery, limit: 10 } });
        const allContacts = res.data.contacts || [];
        // Filter out those already in the group
        const currentIds = contacts.map(c => c._id);
        const filtered = allContacts.filter(c => !currentIds.includes(c._id));
        setSearchResults(filtered);
        setShowResults(true);
      } catch (err) {
        console.error("Search error:", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, contacts]);

  // Close search results on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (resultsRef.current && !resultsRef.current.contains(event.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ================= ADD MEMBER ================= */
  const addMember = async (contact) => {
    setAddingMember(contact._id);
    try {
      const updatedIds = [...contacts.map(c => c._id), contact._id];

      await api.put(`/contact-groups/${group._id}`, {
        name: group.name,
        contactIds: updatedIds,
      });

      setContacts(prev => [...prev, contact]);
      setSearchQuery("");
      setShowResults(false);
      onUpdated?.();
    } catch (err) {
      console.error("Failed to add member", err);
    } finally {
      setAddingMember(null);
    }
  };

  /* ================= QUICK CREATE CONTACT & ADD ================= */
  const quickCreateAndAdd = async () => {
    const phone = searchQuery.replace(/\D/g, "");
    if (phone.length < 10) {
      alert("Please enter a name and valid phone number (e.g. 'John 9876543210')");
      return;
    }

    setLoading(true);
    try {
      const nameMatch = searchQuery.match(/[a-zA-Z]+/g);
      const name = nameMatch ? nameMatch.join(' ') : "New Member";

      // 1. Create Contact
      const contactRes = await api.post("/contacts", {
        name: name,
        phone: phone
      });

      const newContact = contactRes.data.contact;

      // 2. Add to Group
      await addMember(newContact);
    } catch (err) {
      console.error("Quick create failed", err);
      alert(err.response?.data?.error || "Failed to create contact");
    } finally {
      setLoading(false);
    }
  };

  /* ================= REMOVE CONTACT ================= */
  const removeFromGroup = async (contactId) => {
    if (!confirm("Remove from group?")) return;

    try {
      const updatedIds = contacts.filter((c) => c._id !== contactId).map(c => c._id);
      await api.put(`/contact-groups/${group._id}`, {
        name: group.name,
        contactIds: updatedIds,
      });

      setContacts((prev) => prev.filter((c) => c._id !== contactId));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
      onUpdated?.();
    } catch (err) {
      console.error("Failed to remove member", err);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const filtered = contacts.filter(c => 
      !memberSearch || 
      c.name?.toLowerCase().includes(memberSearch.toLowerCase()) || 
      c.phone?.includes(memberSearch)
    );
    setSelected(new Set(filtered.map(c => c._id)));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const removeSelectedFromGroup = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Are you sure you want to remove all ${selected.size} selected members from the group?`)) return;

    try {
      const updatedIds = contacts.filter((c) => !selected.has(c._id)).map(c => c._id);
      await api.put(`/contact-groups/${group._id}`, {
        name: group.name,
        contactIds: updatedIds,
      });

      setContacts((prev) => prev.filter((c) => !selected.has(c._id)));
      setSelected(new Set());
      onUpdated?.();
    } catch (err) {
      console.error("Failed to remove selected members", err);
    }
  };

  useEffect(() => {
    setSelected(new Set());
  }, [group?._id]);

  const getAvatarColor = (name) => {
    const colors = ["bg-blue-600", "bg-blue-600", "bg-indigo-600", "bg-purple-600", "bg-rose-600", "bg-amber-600"];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 selection:bg-blue-100 selection:text-blue-900 font-poppins">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-2xl h-[85vh] rounded-[28px] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        
        {/* HEADER - MATCHING EDIT MODAL */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight capitalize font-poppins">{group.name}</h2>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-poppins">Hub Active</span>
               <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wide font-poppins">• {contacts.length} Sync Profiles</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm transition-all text-slate-400 hover:text-slate-600 hover:scale-105 active:scale-95">
            <X size={20} />
          </button>
        </div>

        {/* SEARCH SECTION - Dedicated below header */}
        <div className="px-8 py-5 bg-white border-b border-slate-50 space-y-4">
           <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-poppins">Search or add members</label>
           </div>
           <div className="relative w-full" ref={resultsRef}>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <input
                type="text"
                placeholder="Find existing members or add new via phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 1 && setShowResults(true)}
                className="w-full h-11 pl-11 pr-10 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all text-[13px] font-semibold text-slate-700 placeholder:text-slate-300 font-poppins"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* SEARCH RESULTS DROPDOWN */}
            {showResults && searchQuery.length >= 1 && (
              <div className="absolute top-full left-0 right-0 mt-4 bg-white border border-slate-200/60 rounded-[20px] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                {searchResults.length > 0 ? (
                  <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50 custom-scrollbar">
                    <div className="px-5 py-3 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-poppins">Contact Pool</div>
                    {searchResults.map((c) => (
                      <button
                        key={c._id}
                        onClick={() => addMember(c)}
                        disabled={addingMember === c._id}
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-blue-50/40 transition-colors group text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-9 h-9 rounded-xl ${getAvatarColor(c.name)} text-white flex items-center justify-center text-xs font-bold shadow-sm`}>
                            {c.name?.[0]}
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-slate-800 tracking-tight font-poppins">{c.name}</div>
                            <div className="text-[11px] font-bold text-slate-400 font-poppins">+{c.phone}</div>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform hover:scale-105 active:scale-95">
                          {addingMember === c._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={3} />}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : searchQuery.length >= 5 ? (
                  <div className="p-8 text-center bg-white">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100">
                      <UserPlus className="w-7 h-7" />
                    </div>
                    <h4 className="text-[14px] font-bold text-slate-800 tracking-tight font-poppins">Join New Member</h4>
                    <p className="text-[11px] text-slate-500 mb-5 px-4 font-medium leading-relaxed font-poppins">Create and sync profile to this hub hub.</p>
                    <button
                      onClick={quickCreateAndAdd}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/10 transition-all active:scale-95 flex items-center justify-center gap-2 font-poppins"
                    >
                      Initialize & Sync
                    </button>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-white">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2 opacity-40" />
                    <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase font-poppins">Syncing...</p>
                  </div>
                )}
              </div>
            )}
           </div>
        </div>

        {/* MEMBER LIST */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-white">
          {loading && contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-50">
               <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-poppins">Reading Hub Population...</p>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-10">
               <div className="w-20 h-20 bg-slate-50 rounded-[28px] flex items-center justify-center mb-6 border border-slate-100">
                 <Users className="w-10 h-10 text-slate-200" strokeWidth={1.5} />
               </div>
               <h4 className="text-[18px] font-bold text-slate-900 tracking-tight font-poppins">Hub Currently Empty</h4>
               <p className="text-[13px] text-slate-500 mt-2 max-w-[280px] font-medium leading-relaxed font-poppins">Start populating members by searching the directory above.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              <div className="px-8 py-3 bg-slate-50 flex items-center justify-between border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2 group flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text"
                    placeholder="Search in member list..."
                    value={memberSearch}
                    onChange={(e) => {
                      setMemberSearch(e.target.value);
                      setSelected(new Set()); // Clear selection when search changes
                    }}
                    className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-600 placeholder:text-slate-400 w-full"
                  />
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2">
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
                  {selected.size > 0 && (
                    <button
                      onClick={removeSelectedFromGroup}
                      className="py-1 px-2.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove Selected ({selected.size})</span>
                    </button>
                  )}
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                     {contacts.length} Total Members
                  </div>
                </div>
              </div>

              <div className="px-8 py-3 bg-slate-50/50 flex items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest transition-all">
                 <div className="w-[32px]"></div> {/* For checkbox alignment */}
                 <div className="flex-1">Member Profile</div>
                 <div className="w-[140px] text-center shrink-0">Channel</div>
                 <div className="w-[80px] text-right shrink-0">Ops</div>
              </div>
              
              {contacts.filter(c => 
                !memberSearch || 
                c.name?.toLowerCase().includes(memberSearch.toLowerCase()) || 
                c.phone?.includes(memberSearch)
              ).map((c) => (
                <div 
                  key={c._id}
                  className="px-8 py-4 flex items-center hover:bg-slate-50/40 transition-all group"
                >
                   {/* Checkbox */}
                   <div 
                     onClick={() => toggleSelect(c._id)}
                     className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer mr-3 shrink-0 ${selected.has(c._id) ? 'bg-red-600 border-red-600 shadow-md shadow-red-500/10 animate-in zoom-in-95 duration-150' : 'border-slate-200 bg-white hover:border-red-200'}`}
                   >
                     {selected.has(c._id) && <X className="text-white w-3 h-3" strokeWidth={3} />}
                   </div>

                   <div className="flex-1 flex items-center gap-4 min-w-0">
                      <div className={`shrink-0 w-9 h-9 rounded-xl ${getAvatarColor(c.name)} text-white flex items-center justify-center font-bold text-xs border border-white/10`}>
                        {c.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[14px] font-bold text-slate-700 leading-tight truncate font-poppins">{c.name || "Unknown Member"}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5 font-poppins">REF_{c._id.slice(-6).toUpperCase()}</span>
                      </div>
                   </div>

                   <div className="shrink-0 w-[140px] flex justify-center items-center gap-2 font-bold text-slate-500 text-[12px] font-poppins">
                      <Phone size={13} className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                      <span className="truncate">{c.phone?.startsWith('+') ? c.phone : `+${c.phone}`}</span>
                   </div>

                   <div className="shrink-0 w-[80px] flex justify-end">
                      <button
                        onClick={() => removeFromGroup(c._id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                        title="Remove Member"
                      >
                        <Trash2 size={16} />
                      </button>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER - Matching Edit style */}
        <div className="px-8 py-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[240px] font-poppins">
              This hub is synchronized with your active campaigns
            </p>
            <button
              onClick={onClose}
              className="px-8 py-3 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[12px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-sm font-poppins"
            >
              Close View
            </button>
        </div>
      </div>
    </div>
  );
}
