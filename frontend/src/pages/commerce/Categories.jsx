import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit,
  GitBranch,
  RefreshCw,
  FolderPlus,
  Zap
} from "lucide-react";
import api from "../../api/api";
import { motion, AnimatePresence } from "framer-motion";
import nicePrompt from "../../components/UI/NicePrompt";

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [syncingId, setSyncingId] = useState(null);
  const [importingMeta, setImportingMeta] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get("/commerce/categories");
      setCategories(res.data.categories || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ name: category.name, description: category.description || "" });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", description: "" });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await api.put(`/commerce/categories/${editingCategory._id}`, formData);
        nicePrompt.success("Success", "Category updated");
      } else {
        await api.post("/commerce/categories", formData);
        nicePrompt.success("Success", "Category created");
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (err) {
      nicePrompt.error("Error", "Operation failed");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      await api.delete(`/commerce/categories/${id}`);
      nicePrompt.success("Deleted", "Category removed");
      fetchCategories();
    } catch (err) {
      nicePrompt.error("Error", "Failed to delete");
    }
  };

  const handleSyncToMeta = async (id) => {
    try {
      setSyncingId(id);
      const res = await api.post(`/commerce/categories/${id}/sync`);
      if (res.data.success) {
        nicePrompt.success("Synced", "Category linked to Meta Product Set");
        fetchCategories();
      }
    } catch (err) {
      nicePrompt.error("Sync Failed", err.response?.data?.error || "Meta API error");
    } finally {
      setSyncingId(null);
    }
  };

  const handleImportFromMeta = async () => {
    try {
      setImportingMeta(true);
      const res = await api.post("/commerce/import-categories");
      if (res.data.success) {
        nicePrompt.success("Import Successful", res.data.message);
        fetchCategories();
      }
    } catch (err) {
      nicePrompt.error("Import Failed", err.response?.data?.error || "Failed to import categories");
    } finally {
      setImportingMeta(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-[#F4FAFF] min-h-screen font-poppins">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <GitBranch className="text-blue-600" /> Categories
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Organize your products for WhatsApp Catalog sets</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleImportFromMeta}
            disabled={importingMeta}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95"
          >
            {importingMeta ? <RefreshCw size={20} className="animate-spin" /> : <RefreshCw size={20} />}
            {importingMeta ? "Importing..." : "Sync from Meta"}
          </button>
          
          <button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
            <Plus size={20} /> New Category
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-48 bg-white rounded-[32px] animate-pulse border border-slate-100" />)
        ) : categories.length === 0 ? (
          <div className="col-span-full py-20 bg-white rounded-[40px] border border-dashed border-slate-200 text-center flex flex-col items-center">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                <FolderPlus size={40} />
             </div>
             <p className="text-slate-400 font-extrabold text-lg">No Categories Yet</p>
             <p className="text-slate-400 text-sm">Create categories to organize your Meta Catalog</p>
          </div>
        ) : categories.map(cat => (
          <motion.div
            layout
            key={cat._id}
            className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-100/30 transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-50/50 transition-colors" />
            
            <div className="relative">
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl shadow-sm ${cat.isSynced ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  <GitBranch size={28} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSyncToMeta(cat._id)}
                    disabled={syncingId === cat._id}
                    className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all shadow-sm active:scale-90 ${syncingId === cat._id ? 'bg-slate-50 text-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    title="Link to Meta Product Set"
                  >
                    {syncingId === cat._id ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} fill={cat.isSynced ? 'currentColor' : 'none'} />}
                  </button>
                  <button 
                    onClick={() => handleOpenModal(cat)} 
                    className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 shadow-sm transition-all active:scale-90"
                    title="Edit Category"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(cat._id)} 
                    className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 shadow-sm transition-all active:scale-90"
                    title="Delete Category"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-2">{cat.name}</h3>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {cat.isSynced ? (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md text-[9px] font-black uppercase tracking-tighter">Meta Synced</span>
                ) : (
                  <span className="px-2 py-0.5 bg-slate-50 text-slate-400 border border-slate-100 rounded-md text-[9px] font-black uppercase tracking-tighter">Local Only</span>
                )}
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-md text-[9px] font-black uppercase tracking-tighter">Dynamic Set</span>
              </div>

              <p className="text-sm text-slate-500 font-medium leading-relaxed line-clamp-2">
                {cat.description || "Organize your products under this category for better catalog browsing."}
              </p>

              {cat.metaCategoryId && (
                <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Product Set ID</span>
                  <span className="text-[10px] font-mono text-slate-900 bg-slate-50 px-2 py-1 rounded-lg">{cat.metaCategoryId}</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8">
              <h2 className="text-2xl font-extrabold text-slate-900 mb-6">{editingCategory ? 'Edit Category' : 'New Category'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Category Name</label>
                  <input
                    required
                    type="text"
                    className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-blue-100"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Description</label>
                  <textarea
                    className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-blue-100"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">Cancel</button>
                  <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-extrabold shadow-lg shadow-blue-200">Save Category</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
