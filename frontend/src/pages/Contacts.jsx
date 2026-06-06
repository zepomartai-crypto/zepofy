import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { saveAs } from "file-saver";
import {
  Search,
  Upload,
  Download,
  Trash2,
  X,
  Users,
  Filter,
  FileText,
  Plus,
  ChevronDown,
  MoreVertical,
  Check,
  MessageSquare
} from "lucide-react";
import Modal from "../components/UI/Modal";
import DensitySelector from "../components/UI/DensitySelector";
import nicePrompt from "../components/UI/NicePrompt";
import { cn } from "../utils/cn";
import AddToGroupModal from "../components/groups/AddToGroupModal";

const Tag = ({ label, color }) => (
  <span
    className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border"
    style={{
      backgroundColor: color ? `${color}15` : '#eff6ff',
      color: color || '#2563eb',
      borderColor: color ? `${color}30` : '#dbeafe'
    }}
  >
    {label}
  </span>
);

const GroupBadge = ({ label }) => (
  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
    {label}
  </span>
);

const SourceBadge = ({ source }) => {
  const isInbound = source?.toLowerCase().includes('inbound');
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border",
      isInbound
        ? "bg-indigo-50 text-indigo-600 border-indigo-100"
        : "bg-blue-50 text-blue-600 border-blue-100"
    )}>
      {source}
    </span>
  );
};

/* ---------------- IMPORT MODAL ---------------- */

const ImportModal = ({ open, onClose, onImported, groups = [] }) => {
  const [file, setFile] = useState(null);
  const [groupId, setGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGroupList, setShowGroupList] = useState(false);
  const [progress, setProgress] = useState(0); // 🔥 NEW: Progress state
  const [failedRows, setFailedRows] = useState([]); // 🔥 NEW: Failed rows

  const downloadSampleCSV = () => {
    const sampleData = [["name", "phone"], ["Ravi Bhai", "9876543210"]];
    const csvContent = sampleData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "contacts_sample.csv");
  };

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;

    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("file", file);
      if (groupId === "NEW") {
        if (!newGroupName.trim()) {
          nicePrompt.error("Required", "Please enter a name for the new group.");
          setLoading(false);
          return;
        }
        fd.append("newGroupName", newGroupName.trim());
      } else if (groupId) {
        fd.append("groupId", groupId);
      }

      const res = await api.post("/contacts/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (p) => {
          const percentComplete = Math.round((p.loaded * 100) / p.total);
          setProgress(percentComplete);
        }
      });
      onImported();
      if (res.data.failedRows && res.data.failedRows.length > 0) {
        setFailedRows(res.data.failedRows);
      } else {
        onClose();
        nicePrompt.success("Import Successful", "Your contacts have been successfully added to the database.");
      }
    } catch (err) {
      nicePrompt.error("Import Failed", err.response?.data?.error || "We encountered an error while processing your file. Please check the format.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/60 animate-in zoom-in-95 duration-200"
      >
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Import Contacts</h3>
            <p className="text-[12px] text-slate-500 font-medium mt-1">Upload your CSV or Excel file to reach more people</p>
          </div>
          <button onClick={() => { setFailedRows([]); onClose(); }} type="button" className="p-2 rounded-lg hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8">
          {failedRows.length > 0 ? (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-full mt-0.5">
                  <X className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-orange-800 font-bold text-sm">Import Completed with Errors</h4>
                  <p className="text-orange-600 text-xs mt-1">Some numbers could not be imported because they are invalid or already exist.</p>
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl bg-slate-50 shadow-inner">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-widest text-[9px] sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {failedRows.map((row, i) => (
                      <tr key={i} className="hover:bg-white transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-700 truncate max-w-[120px]">{row.name}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{row.phone}</td>
                        <td className="px-4 py-3 text-red-500 font-medium text-[11px]">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
              <div className="border-2 border-dashed border-slate-200 rounded-[20px] p-10 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group relative">
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={(e) => setFile(e.target.files?.[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  id="csv-file-input"
                />
                <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 mx-auto mb-4 group-hover:scale-105 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-slate-700 mb-1">
                  {file ? file.name : "Choose CSV or Excel File"}
                </p>
                <p className="text-xs text-slate-400 font-medium">
                  Drag and drop or click to browse (Max 10MB)
                </p>
              </div>

              {file && (
                <div className="mt-4 space-y-3">
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      <span className="text-xs text-blue-700 font-bold truncate max-w-[200px]">{file.name}</span>
                    </div>
                    <button type="button" onClick={() => { setFile(null); setProgress(0); }} className="text-blue-600 hover:text-blue-800"><X className="w-3.5 h-3.5" /></button>
                  </div>

                  {loading && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span>Uploading...</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Group Selection for Import */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Assign to Group (Optional)</label>
                  <button
                    type="button"
                    onClick={() => setGroupId(groupId === "NEW" ? "" : "NEW")}
                    className="text-blue-600 hover:text-blue-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 hover:shadow-sm active:scale-95 cursor-pointer"
                  >
                    {groupId === "NEW" ? "← Back to List" : "+ Create New Group"}
                  </button>
                </div>

                <div className="min-h-[85px] transition-all duration-300">
                  {groupId === "NEW" ? (
                    <div className="animate-in slide-in-from-right-2 duration-300">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Enter new group name..."
                        className="w-full h-11 px-4 bg-blue-50 border border-blue-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-bold text-slate-700 shadow-sm"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                      />
                      <p className="text-[10px] text-blue-500 mt-2 font-bold italic">
                        * A new group will be created automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="relative animate-in slide-in-from-left-2 duration-300">
                      <button
                        type="button"
                        onClick={() => setShowGroupList(!showGroupList)}
                        className="w-full h-11 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-bold text-slate-700 shadow-sm cursor-pointer"
                      >
                        <span className="truncate">
                          {groupId ? groups.find(g => g._id === groupId)?.name : "No Group (Default)"}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${showGroupList ? 'rotate-180' : ''}`} />
                      </button>

                      {showGroupList && (
                        <>
                          <div
                            className="fixed inset-0 z-[10]"
                            onClick={() => setShowGroupList(false)}
                          />
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-[20] overflow-hidden animate-in zoom-in-95 duration-200 origin-top">
                            <div className="max-h-[160px] overflow-y-auto custom-scrollbar p-1">
                              <button
                                type="button"
                                onClick={() => { setGroupId(""); setShowGroupList(false); }}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${!groupId ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                              >
                                No Group (Default)
                              </button>
                              {groups.map((g) => (
                                <button
                                  key={g._id}
                                  type="button"
                                  onClick={() => { setGroupId(g._id); setShowGroupList(false); }}
                                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all mt-0.5 ${groupId === g._id ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {g.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                      <p className="text-[10px] text-slate-400 mt-2 italic font-medium">
                        * All imported contacts will be added to this group.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={downloadSampleCSV}
            className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
          >
            Download Sample CSV
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setFailedRows([]); onClose(); }}
              className="btn-compact text-slate-500 hover:text-slate-700"
            >
              {failedRows.length > 0 ? "Close" : "Cancel"}
            </button>
            {failedRows.length === 0 && (
              <button
                type="submit"
                disabled={loading || !file}
                className="btn-compact bg-slate-900 text-white hover:bg-black shadow-lg shadow-slate-200 disabled:opacity-50"
              >
                {loading ? "Importing..." : "Start Import"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

const AddContactModal = ({ open, onClose, groups, availableGlobalTags, onSubmit, editContact }) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [groupId, setGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [showGroupList, setShowGroupList] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]); // Array instead of string

  const [loading, setLoading] = useState(false); // 🔥 NEW: Loading state

  useEffect(() => {
    if (editContact && open) {
      setName(editContact.name || "");
      setPhone(editContact.phone || "");
      setWhatsapp(editContact.phone || "");
      setGroupId(editContact.groupId || "");
      setSelectedTags(editContact.tags || []);
    }
    if (!editContact && open) {
      setName(""); setPhone(""); setWhatsapp(""); setGroupId(""); setNewGroupName(""); setSelectedTags([]);
    }
  }, [editContact, open]);

  const handleSave = async () => {
    if (!name || !phone) return nicePrompt.error("Required", "Please enter both name and phone number.");

    setLoading(true);
    try {
      await onSubmit({ name, phone, whatsapp, groupId, newGroupName, tags: selectedTags });
    } catch (err) {
      // Error handling is actually done in the parent onSubmit now, but we stop loading here
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">{editContact ? "Edit Contact" : "New Contact"}</h2>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Contact profile configuration</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Full Name</label>
              <input
                className="input-compact w-full shadow-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Phone Number</label>
              <input
                className="input-compact w-full shadow-sm"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setWhatsapp(e.target.value); }}
                placeholder="e.g. 919876543210"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Select Tags</label>
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl min-h-[60px]">
              {availableGlobalTags?.length > 0 ? (
                availableGlobalTags.map(tag => {
                  const isSelected = selectedTags.includes(tag.name);
                  return (
                    <button
                      key={tag._id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTags(selectedTags.filter(t => t !== tag.name));
                        } else {
                          setSelectedTags([...selectedTags, tag.name]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border shadow-sm ${isSelected
                        ? "bg-blue-600 border-blue-600 text-white shadow-blue-500/20"
                        : "bg-white border-slate-200 text-slate-600 hover:border-blue-400"
                        }`}
                    >
                      {tag.name}
                    </button>
                  )
                })
              ) : (
                <p className="text-[11px] text-slate-400 italic">No tags defined. Go to Settings &gt; Tags to create some.</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Assign to Group</label>
              <button
                type="button"
                onClick={() => {
                  setGroupId(groupId === "NEW" ? "" : "NEW");
                  setNewGroupName("");
                  setShowGroupList(false);
                }}
                className="text-blue-600 hover:text-blue-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 hover:shadow-sm active:scale-95 cursor-pointer"
              >
                {groupId === "NEW" ? "← Back to List" : "+ Create New Group"}
              </button>
            </div>

            <div className="min-h-[45px]">
              {groupId === "NEW" ? (
                <div className="animate-in slide-in-from-right-2 duration-300">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter new group name..."
                    className="w-full h-11 px-4 bg-blue-50 border border-blue-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-bold text-slate-700 shadow-sm"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>
              ) : (
                <div className="relative animate-in slide-in-from-left-2 duration-300">
                  <button
                    type="button"
                    onClick={() => setShowGroupList(!showGroupList)}
                    className="w-full h-11 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-bold text-slate-700 shadow-sm cursor-pointer"
                  >
                    <span className="truncate">
                      {groupId ? (groups.find(g => g._id === groupId)?.name || "Select Group") : "No Group"}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${showGroupList ? 'rotate-180' : ''}`} />
                  </button>

                  {showGroupList && (
                    <>
                      <div
                        className="fixed inset-0 z-[1010]"
                        onClick={() => setShowGroupList(false)}
                      />
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-[1020] overflow-hidden animate-in zoom-in-95 duration-200 origin-top">
                        <div className="max-h-[160px] overflow-y-auto custom-scrollbar p-1">
                          <button
                            type="button"
                            onClick={() => { setGroupId(""); setShowGroupList(false); }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${!groupId ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            No Group
                          </button>
                          {groups.map((g) => (
                            <button
                              key={g._id}
                              type="button"
                              onClick={() => { setGroupId(g._id); setShowGroupList(false); }}
                              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all mt-0.5 ${groupId === g._id ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                              {g.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-5 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2 rounded-b-2xl">
          <button onClick={onClose} disabled={loading} className="btn-compact text-slate-500 hover:text-slate-700">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn-compact bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {editContact ? "Update Contact" : "Create Contact"}
          </button>
        </div>
      </div>
    </div>
  );
};

// 🔹 FILTER SYSTEM START
const FilterDrawer = ({ open, onClose, filters, setFilters, onApply, onReset, groups, availableTags }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-soft border border-slate-200/60 animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Filter Contacts</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Refine list visibility</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-white border border-slate-100 shadow-sm transition-all text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 pl-1">
                <Search className="w-3 h-3 text-blue-500" />
                Search Keyword
              </label>
              <div className="relative group">
                <input
                  type="text"
                  value={filters.keyword}
                  onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                  placeholder="Search name, phone, or tags..."
                  className="w-full h-11 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-semibold text-slate-700 shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 pl-1">
                  <Plus className="w-3 h-3 text-emerald-500" />
                  From Date
                </label>
                <input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-bold text-slate-600 shadow-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 pl-1">
                  <Plus className="w-3 h-3 text-emerald-500" />
                  To Date
                </label>
                <input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-bold text-slate-600 shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 pl-1">
                  <Users className="w-3 h-3 text-purple-500" />
                  By Group
                </label>
                <div className="relative">
                  <select
                    value={filters.groupId}
                    onChange={(e) => setFilters({ ...filters, groupId: e.target.value })}
                    className="w-full h-11 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-bold text-slate-600 appearance-none cursor-pointer shadow-sm"
                  >
                    <option value="">All Groups</option>
                    {groups.map((g) => (
                      <option key={g._id} value={g._id}>{g.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 pl-1">
                  <Plus className="w-3 h-3 text-blue-400" />
                  By Tag
                </label>
                <div className="relative">
                  <select
                    value={filters.tag}
                    onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
                    className="w-full h-11 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-bold text-slate-600 appearance-none cursor-pointer shadow-sm"
                  >
                    <option value="">All Tags</option>
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 pl-1">
                <FileText className="w-3 h-3 text-orange-500" />
                Acquisition Source
              </label>
              <div className="relative">
                <select
                  value={filters.source}
                  onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                  className="w-full h-11 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-bold text-slate-600 appearance-none cursor-pointer shadow-sm"
                >
                  <option value="">All Sources</option>
                  <option value="MANUAL">Manually Added</option>
                  <option value="CSV_IMPORT">CSV/Excel Import</option>
                  <option value="WHATSAPP_INBOUND">WhatsApp Inbound</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex items-center gap-3">
          <button
            onClick={() => { onReset(); onClose(); }}
            className="flex-1 h-11 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            Reset All
          </button>
          <button
            onClick={() => { onApply(); onClose(); }}
            className="flex-[2] h-11 bg-blue-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-blue-500/10 active:scale-95"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};
// 🔹 FILTER SYSTEM END

/* ---------------- BULK TAG MODAL ---------------- */
const BulkTagModal = ({ open, onClose, tags, onApply }) => {
  const [selectedTag, setSelectedTag] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-soft overflow-hidden border border-slate-200/60 animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Bulk Add Tag</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Apply tag to selected contacts</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block pl-1">
            Select Created Tag
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
            {tags.map(tag => (
              <button
                key={tag._id}
                onClick={() => setSelectedTag(tag.name)}
                className={`px-3 py-2.5 rounded-xl text-[12px] font-bold border transition-all text-left truncate ${selectedTag === tag.name
                  ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-50 border-slate-100 text-slate-600 hover:border-blue-400 hover:bg-white"
                  }`}
              >
                {tag.name}
              </button>
            ))}
            {tags.length === 0 && (
              <div className="col-span-2 py-8 text-center text-slate-400 text-xs italic">
                No tags created in Settings.
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-5 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="btn-compact text-slate-500 hover:text-slate-700">
            Cancel
          </button>
          <button
            onClick={() => { if (selectedTag) onApply(selectedTag); }}
            disabled={!selectedTag}
            className="btn-compact bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            Apply Tag
          </button>
        </div>
      </div>
    </div>
  );
};


/* ---------------- MAIN PAGE ---------------- */

export default function Contacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);


  const [addOpen, setAddOpen] = useState(false);
  const [groups, setGroups] = useState([]);


  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(() => {
    const saved = localStorage.getItem("contactsDensity");
    return saved ? Number(saved) : 10;
  });

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    localStorage.setItem("contactsDensity", newLimit);
    setPage(1);
  };

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false); // 🔥 NEW: Global Select All flag
  const [importOpen, setImportOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [globalTags, setGlobalTags] = useState([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  const [editContact, setEditContact] = useState(null);

  const [activeGroup, setActiveGroup] = useState(null);

  const [allContacts, setAllContacts] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  const findContactGroupId = (contactId) => {
    const g = groups.find(g => g.contactIds?.includes(contactId));
    return g?._id || "";
  };



  // 🔹 FILTER SYSTEM START
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({
    keyword: "",
    fromDate: "",
    toDate: "",
    groupId: "",
    source: "",
    tag: ""
  });

  const loadGlobalTags = async () => {
    try {
      const res = await api.get("/tags");
      if (res.data.success) {
        setGlobalTags(res.data.tags || []);
      }
    } catch (err) {
      console.error("Failed to load global tags", err);
    }
  };

  const loadAvailableTags = async () => {
    try {
      const res = await api.get("/contacts/tags");
      setAvailableTags(res.data.tags || []);
    } catch (err) {
      console.error("Failed to load used tags", err);
    }
  };

  // 🔹 FILTER SYSTEM END


  /* ---------------- LOAD CONTACTS ---------------- */

  const load = async (p = page, l = limit, s = search, f = filters) => {
    setLoading(true);

    const params = { page: p, limit: l, search: s };
    if (activeGroup) params.groupId = activeGroup._id;

    // 🔹 Advanced Filter mapping
    if (f.keyword) params.search = f.keyword; // Keyword overrides simple search
    if (f.fromDate) params.fromDate = f.fromDate;
    if (f.toDate) params.toDate = f.toDate;
    if (f.groupId) params.groupId = f.groupId;
    if (f.source) params.source = f.source;
    if (f.tag) params.tag = f.tag;

    const res = await api.get("/contacts", { params });
    setContacts(res.data.contacts || []);
    setTotal(res.data.total || 0);

    setLoading(false);
  };


  useEffect(() => {
    setContacts([]);
    setSelected(new Set());
    setPage(1);
    load(1, limit);
    loadGroups();
    loadAvailableTags();
    loadGlobalTags();
  }, [search, filters.keyword, filters.groupId, filters.source, filters.tag, filters.fromDate, filters.toDate, limit]);






  /* ---------------- SELECTION ---------------- */

  const toggleSelect = (id) => {
    const s = new Set(selected);
    if (s.has(id)) {
      s.delete(id);
      setIsAllSelected(false);
    } else {
      s.add(id);
    }
    setSelected(s);
  };

  const selectAll = async () => {
    if (isAllSelected || selected.size === contacts.length) {
      setSelected(new Set());
      setIsAllSelected(false);
    } else {
      // If total > current page, ask or just do global select?
      // User requested "Select All" should select ALL in DB.
      if (total > contacts.length) {
        setIsAllSelected(true);
        setSelected(new Set(contacts.map(c => c._id))); // Visual feedback for current page
      } else {
        setSelected(new Set(contacts.map(c => c._id)));
        setIsAllSelected(false);
      }
    }
  };

  /* ---------------- BULK ACTIONS ---------------- */

  const bulkAction = async (action, extraData = {}) => {
    const confirmed = await nicePrompt.confirm(
      `${action.replace(/_/g, ' ')} Contacts`,
      `Are you sure you want to perform this action on ${isAllSelected ? total : selected.size} contacts?`,
      action === "DELETE" ? "danger" : "primary"
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      await api.post("/contacts/bulk-action", {
        action,
        contactIds: isAllSelected ? [] : [...selected],
        selectAll: isAllSelected,
        filters: { search, ...filters },
        ...extraData
      });
      setSelected(new Set());
      setIsAllSelected(false);
      load();
      nicePrompt.success("Success", "Bulk action completed successfully.");
    } catch (err) {
      nicePrompt.error("Failed", err.response?.data?.error || "Bulk action failed.");
    } finally {
      setLoading(false);
    }
  };

  const quickAssignGroup = async (groupId) => {
    if (!groupId) return;
    try {
      setLoading(true);
      await api.post("/groups/add-contacts", {
        groupId,
        contactIds: isAllSelected ? [] : [...selected],
        selectAll: isAllSelected,
        filters: { search, ...filters }
      });
      setSelected(new Set());
      setIsAllSelected(false);
      load();
      nicePrompt.success("Success", "Contacts assigned to group successfully.");
    } catch (err) {
      nicePrompt.error("Failed", err.response?.data?.error || "Failed to assign group.");
    } finally {
      setLoading(false);
    }
  };

  const bulkDelete = () => bulkAction("DELETE");

  const loadGroups = async () => {
    try {
      const res = await api.get("/contact-groups");
      setGroups(res.data.groups || []);
    } catch (err) {
      console.error(err);
      console.error("Failed to load groups");
    }
  };



  const exportSelected = async () => {
    if (selected.size === 0 && !isAllSelected) {
      nicePrompt.error("No Selection", "Please select at least one contact to export.");
      return;
    }

    setLoading(true);
    try {
      let exportContacts = [];
      const params = { page: 1, limit: 0, search };
      if (activeGroup) params.groupId = activeGroup._id;
      if (filters.keyword) params.search = filters.keyword;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
      if (filters.groupId) params.groupId = filters.groupId;
      if (filters.source) params.source = filters.source;
      if (filters.tag) params.tag = filters.tag;

      const res = await api.get("/contacts", { params });
      const allMatchingContacts = res.data.contacts || [];

      if (isAllSelected) {
        exportContacts = allMatchingContacts;
      } else {
        exportContacts = allMatchingContacts.filter(c => selected.has(c._id));
      }

      if (exportContacts.length === 0) {
        nicePrompt.error("Empty List", "No contacts found to export.");
        return;
      }

      const rows = [
        "name,phone,source",
        ...exportContacts.map((c) => `${c.name},${c.phone},${c.source}`),
      ];

      saveAs(new Blob([rows.join("\n")], { type: "text/csv" }), `contacts_export_${Date.now()}.csv`);
      nicePrompt.success("Export Successful", `${exportContacts.length} contacts exported.`);
    } catch (err) {
      console.error(err);
      nicePrompt.error("Export Failed", "Could not export contacts.");
    } finally {
      setLoading(false);
    }
  };

  const exportAll = () => {
    if (contacts.length === 0) {
      nicePrompt.error("Empty List", "There are no contacts available to export.");
      return;
    }

    const rows = [
      "name,phone,source",
      ...contacts.map((c) => `${c.name},${c.phone},${c.source}`),
    ];

    saveAs(
      new Blob([rows.join("\n")], { type: "text/csv" }),
      `contacts_${Date.now()}.csv`
    );
  };
  /* ---------------- PAGINATION ---------------- */


  const pages = useMemo(() => Math.ceil(total / limit), [total, limit]);

  /* ---------------- UI ---------------- */

  return (
    <>
      <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden">
        {/* Page Header */}
        <div className="px-6 py-6 shrink-0 space-y-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-2xl">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Search name or mobile number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 transition-all shadow-soft"
                />
              </div>
              <button
                onClick={() => setFilterDrawerOpen(true)}
                className="btn-compact bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <Filter className={cn("w-3.5 h-3.5 hover:text-blue-500", (filters.keyword || filters.groupId || filters.tag) ? "text-blue-500" : "text-slate-400")} />
                <span>Filter</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddOpen(true)}
                className="btn-compact bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Contact</span>
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="btn-compact bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <span>Import</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={exportSelected}
                disabled={selected.size === 0 && !isAllSelected}
                className="btn-compact bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Export</span>
              </button>
            </div>
          </div>

        </div>

        {/* Table Section */}
        <div className="flex-1 overflow-hidden px-6 pb-6">
          <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200/60 shadow-soft overflow-hidden">
            {/* Table Header Controls */}
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/30 shrink-0">
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Contacts Directory</div>
              </div>
              <div className="flex items-center gap-3">
                <DensitySelector
                  value={limit}
                  onChange={(val) => handleLimitChange(val)}
                  options={[
                    { label: "5 Rows", value: 5 },
                    { label: "10 Rows", value: 10 },
                    { label: "20 Rows", value: 20 },
                    { label: "50 Rows", value: 50 },
                    { label: "100 Rows", value: 100 },
                    { label: "250 Rows", value: 250 },
                    { label: "500 Rows", value: 500 },
                  ]}
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-sm shadow-sm ring-1 ring-slate-200/20">
                  <tr>
                    <th className="w-12 pl-6 py-3 border-b border-slate-200/60">
                      <input
                        type="checkbox"
                        checked={isAllSelected || (selected.size === contacts.length && contacts.length > 0)}
                        onChange={selectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Contact Identity</th>
                    <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Phone Details</th>
                    <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Groups</th>
                    <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Tags</th>
                    <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Acquisition</th>
                    <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60">Date Added</th>
                    <th className="px-5 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60 pr-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="p-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Fetching Data...</p>
                        </div>
                      </td>
                    </tr>
                  ) : contacts.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-20 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-40">
                          <Users className="w-12 h-12 text-slate-300" />
                          <div>
                            <p className="text-sm font-bold text-slate-500">No Contacts Found</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Start by adding your first contact</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    contacts.map((c) => (
                      <tr key={c._id} className="group hover:bg-blue-50/20 transition-all duration-200">
                        <td className="pl-6 py-3.5">
                          <input
                            type="checkbox"
                            checked={isAllSelected || selected.has(c._id)}
                            onChange={() => toggleSelect(c._id)}
                            className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500/20 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-5 py-3.5">
                          <div
                            className="flex items-center gap-3 cursor-pointer group/name"
                            onClick={() => toggleSelect(c._id)}
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-sm truncate group-hover/name:text-blue-700 transition-colors">{c.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5 group-hover/name:text-blue-400 transition-colors">ID_{c._id?.slice(-8).toUpperCase()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[13px] font-semibold text-slate-700 tracking-tight">
                            {c.phone?.startsWith('+') ? c.phone : `+${c.phone}`}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div
                            onClick={() => { setEditContact({ ...c, groupId: findContactGroupId(c._id) }); setAddOpen(true); }}
                            className="flex flex-wrap gap-1.5 cursor-pointer hover:bg-slate-100/50 p-1 rounded-lg transition-colors min-h-[30px]"
                          >
                            {(() => {
                              const contactGroups = groups.filter(g => g.contactIds?.includes(c._id));
                              return contactGroups.length > 0 ? contactGroups.map(g => (
                                <GroupBadge key={g._id} label={g.name} />
                              )) : <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic opacity-60">No Group</span>;
                            })()}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div
                            onClick={() => { setEditContact({ ...c, groupId: findContactGroupId(c._id) }); setAddOpen(true); }}
                            className="flex flex-wrap gap-1 cursor-pointer hover:bg-slate-100/50 p-1 rounded-lg transition-colors min-h-[30px]"
                          >
                            {(c.tags || []).length > 0 ? (c.tags || []).map(t => {
                              const tagObj = globalTags.find(gt => gt.name === t);
                              return <Tag key={t} label={t} color={tagObj?.color} />;
                            }) : <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic opacity-60">No Tags</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <SourceBadge source={c.source || 'manual'} />
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                            {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="pr-6 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => navigate(`/messages?id=${c._id}`)}
                              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all border border-transparent hover:border-emerald-100 shadow-sm hover:shadow-md"
                              title="Chat with Customer"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setEditContact({ ...c, groupId: findContactGroupId(c._id) }); setAddOpen(true); }}
                              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100 shadow-sm hover:shadow-md"
                              title="Edit Profile"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                const confirmed = await nicePrompt.confirm("Delete Contact", `Are you sure you want to remove "${c.name}"?`, "danger");
                                if (confirmed) {
                                  try {
                                    await api.delete(`/contacts/${c._id}`);
                                    load();
                                    nicePrompt.success("Removed", "Contact has been deleted.");
                                  } catch (e) {
                                    nicePrompt.error("Failed", "Could not delete contact.");
                                  }
                                }
                              }}
                              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 shadow-sm hover:shadow-md"
                              title="Purge Contact"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0 rounded-b-2xl shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
              <div className="text-[12px] font-medium text-slate-500">
                Showing <span className="text-slate-900 font-bold">{total === 0 ? 0 : ((page - 1) * limit) + 1}-{Math.min(page * limit, total)}</span> of <span className="text-slate-900 font-bold">{total}</span> customers
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => { setPage(page - 1); load(page - 1); }}
                  className="flex items-center gap-1.5 h-9 px-4 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:hover:bg-white transition-all active:scale-95 shadow-sm"
                >
                  <ChevronDown className="w-3.5 h-3.5 rotate-90" />
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {(() => {
                    const maxVisible = 3;
                    let start = Math.max(1, page - Math.floor(maxVisible / 2));
                    let end = Math.min(pages, start + maxVisible - 1);
                    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

                    const pageButtons = [];
                    if (start > 1) {
                      pageButtons.push(1);
                      if (start > 2) pageButtons.push("...");
                    }
                    for (let i = start; i <= end; i++) pageButtons.push(i);
                    if (end < pages) {
                      if (end < pages - 1) pageButtons.push("...");
                      pageButtons.push(pages);
                    }

                    return pageButtons.map((p, idx) => (
                      <button
                        key={idx}
                        disabled={p === "..."}
                        onClick={() => { if (p !== "...") { setPage(p); load(p); } }}
                        className={`min-w-[36px] h-9 text-[12px] font-bold rounded-xl transition-all ${page === p
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-105"
                          : p === "..." ? "text-slate-300 cursor-default" : "text-slate-500 hover:bg-slate-100"
                          }`}
                      >
                        {p}
                      </button>
                    ));
                  })()}
                </div>

                <button
                  disabled={page === pages || pages === 0}
                  onClick={() => { setPage(page + 1); load(page + 1); }}
                  className="flex items-center gap-1.5 h-9 px-4 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:hover:bg-white transition-all active:scale-95 shadow-sm"
                >
                  Next
                  <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= BULK ACTIONS FLOATING BAR ================= */}
      {
        selected.size > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-6 z-[200] animate-in slide-in-from-bottom-8 duration-500 border border-white/10">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selection Active</span>
              <span className="text-sm font-bold text-white">{isAllSelected ? `${total} (All)` : selected.size} Contacts</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGroupModalOpen(true)}
                className="btn-compact bg-white/10 hover:bg-white/20 text-white border-transparent"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Group</span>
              </button>
              <button
                onClick={() => setBulkTagOpen(true)}
                className="btn-compact bg-white/10 hover:bg-white/20 text-white border-transparent"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tag</span>
              </button>
              <button
                onClick={bulkDelete}
                className="btn-compact bg-red-500/10 hover:bg-red-500/20 text-red-500 border-transparent"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )
      }

      {/* ================= MODALS & DRAWERS ================= */}
      <AddToGroupModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        selectedContactIds={isAllSelected ? [] : [...selected]}
        selectAll={isAllSelected}
        filters={{ search, ...filters }}
        onAdded={() => { setSelected(new Set()); setIsAllSelected(false); load(page, limit); }}
      />
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => load(1)}
        groups={groups}
      />
      <AddContactModal
        open={addOpen}
        editContact={editContact}
        onClose={() => { setAddOpen(false); setEditContact(null); }}
        groups={groups}
        availableGlobalTags={globalTags}
        onSubmit={async (data) => {
          try {
            if (editContact) {
              await api.put(`/contacts/${editContact._id}`, data);
              nicePrompt.success("Updated", "Contact information has been saved.");
            } else {
              await api.post("/contacts", data);
              nicePrompt.success("Created", "New contact has been added to your directory.");
            }
            setAddOpen(false);
            setEditContact(null);
            load(1);
          } catch (err) {
            const msg = err.response?.data?.error || "Failed to save contact.";
            nicePrompt.error("Error", msg);
            throw err; // Re-throw to stop loading state in modal
          }
        }}
      />
      <FilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={filters}
        setFilters={setFilters}
        availableTags={availableTags}
        onApply={() => { setPage(1); load(1); }}
        onReset={() => {
          const emptyFilters = { keyword: "", fromDate: "", toDate: "", groupId: "", source: "", tag: "" };
          setFilters(emptyFilters);
          setSearch("");
          setPage(1);
          load(1, limit, "", emptyFilters); // Pass fresh state directly to load
        }}
        groups={groups}
      />
      <BulkTagModal
        open={bulkTagOpen}
        onClose={() => setBulkTagOpen(false)}
        tags={globalTags}
        onApply={(tag) => {
          setBulkTagOpen(false);
          bulkAction("ADD_TAG", { tag });
        }}
      />
    </>
  );
}
