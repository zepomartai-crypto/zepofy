import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { FiPlus, FiEdit2, FiTrash2, FiTag, FiSearch, FiX, FiCheck } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

const Tags = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [formData, setFormData] = useState({ name: "", color: "#3b82f6" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const res = await api.get('/tags');
      if (res.data.success) {
        setTags(res.data.tags);
      }
    } catch (err) {
      toast.error("Failed to fetch tags");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (tag = null) => {
    if (tag) {
      setEditingTag(tag);
      setFormData({ name: tag.name, color: tag.color });
    } else {
      setEditingTag(null);
      setFormData({ name: "", color: "#3b82f6" });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error("Name is required");

    setIsSaving(true);
    try {
      if (editingTag) {
        const res = await api.put(`/tags/${editingTag._id}`, formData);
        if (res.data.success) {
          setTags(tags.map(t => t._id === editingTag._id ? res.data.tag : t));
          toast.success("Tag updated");
        }
      } else {
        const res = await api.post('/tags', formData);
        if (res.data.success) {
          setTags([res.data.tag, ...tags]);
          toast.success("Tag created");
        }
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save tag");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure? This will not remove the tag from existing contacts.")) return;
    try {
      const res = await api.delete(`/tags/${id}`);
      if (res.data.success) {
        setTags(tags.filter(t => t._id !== id));
        toast.success("Tag deleted");
      }
    } catch (err) {
      toast.error("Failed to delete tag");
    }
  };

  const filteredTags = tags.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-white rounded-[20px] shadow-sm flex items-center justify-center text-blue-600 border border-slate-100">
            <FiTag size={28} />
          </div>
          <div>
            <h1 className="text-[24px] font-black text-slate-900 tracking-tight leading-tight">Customer Tags</h1>
            <p className="text-[13px] text-slate-500 font-medium mt-1">Manage and organize tags used to categorize customers.</p>
          </div>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3.5 rounded-2xl flex items-center gap-2.5 transition-all active:scale-[0.98] shadow-lg shadow-blue-600/20 text-[14px]"
        >
          <FiPlus size={18} strokeWidth={3} />
          <span>Add New Tag</span>
        </button>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        {/* Search & Filters */}
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white">
          <div className="relative w-full max-w-[400px]">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search tags by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-[14px] font-medium placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Sr. No.</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Tag Name</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Color Code</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                      <p className="text-[14px] font-bold text-slate-400">Loading Tags...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredTags.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center text-slate-400 font-bold">
                    No tags found
                  </td>
                </tr>
              ) : (
                filteredTags.map((tag, index) => (
                  <tr key={tag._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5 text-[14px] font-bold text-slate-400">#{index + 1}</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: tag.color }}>
                          <FiTag size={16} />
                        </div>
                        <span className="text-[15px] font-bold text-slate-700">{tag.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                       <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                          <span className="text-[12px] font-black text-slate-600 uppercase font-mono">{tag.color}</span>
                       </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenModal(tag)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Edit Tag"
                        >
                          <FiEdit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(tag._id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Tag"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-8 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
            <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-full border border-slate-100">
              Total Tags: {filteredTags.length}
            </span>
            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-300 cursor-not-allowed"><FiCheck /></button>
            </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !isSaving && setShowModal(false)} />
          
          <div className="relative bg-white rounded-[32px] w-full max-w-[420px] shadow-2xl border border-white/20 p-8 animate-in zoom-in-95 fade-in duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[20px] font-black text-slate-900 tracking-tight">{editingTag ? "Edit Tag" : "New Tag"}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tag Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. VIP Customer"
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-[15px] font-bold text-slate-700 placeholder:text-slate-300"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-bold text-slate-400 uppercase tracking-widest ml-1">Color Theme</label>
                <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-12 rounded-xl border-none p-0 bg-transparent cursor-pointer overflow-hidden shadow-sm"
                  />
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-slate-700">{formData.color.toUpperCase()}</p>
                    <p className="text-[11px] text-slate-400 font-medium">Click box to pick color</p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <FiCheck size={18} strokeWidth={3} />
                    <span>{editingTag ? "Update Tag" : "Create Tag"}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tags;
