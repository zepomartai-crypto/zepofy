import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  MoreVertical,
  Filter,
  Zap,
  Trash2,
  Edit,
  Package,
  ShoppingBag,
  RefreshCw,
  AlertCircle,
  FileText,
  Upload,
  ChevronDown,
  Image as ImageIcon
} from "lucide-react";
import api from "../../api/api";
import { motion, AnimatePresence } from "framer-motion";
import nicePrompt from "../../components/UI/NicePrompt";
import DensitySelector from "../../components/UI/DensitySelector";

const PRODUCT_CATEGORIES = [
  { label: "Apparel & Accessories", value: "CL" },
  { label: "Arts & Entertainment", value: "AE" },
  { label: "Baby & Toddler", value: "BT" },
  { label: "Business & Industrial", value: "BI" },
  { label: "Electronics", value: "EL" },
  { label: "Furniture", value: "FU" },
  { label: "Health & Beauty", value: "HB" },
  { label: "Home & Garden", value: "HG" },
  { label: "Jewelry & Watches", value: "JW" },
  { label: "Media", value: "ME" },
  { label: "Musical Instruments", value: "MI" },
  { label: "Office Supplies", value: "OS" },
  { label: "Software", value: "SW" },
  { label: "Sporting Goods", value: "SG" },
  { label: "Toys & Games", value: "TG" },
  { label: "Other", value: "OT" }
];

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [importingMeta, setImportingMeta] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [isCatalogConnected, setIsCatalogConnected] = useState(true); // Default true to prevent flicker
  const [permissionMissing, setPermissionMissing] = useState(false);
  const [catalogIdValid, setCatalogIdValid] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [imageSource, setImageSource] = useState("url"); // "url" or "file"

  // Filter State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMetaCategory, setSelectedMetaCategory] = useState("all");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    sku: "",
    imageUrl: "",
    categoryId: "",
    googleCategory: "",
    stock: "",
    syncToMeta: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pRes, cRes, iRes] = await Promise.all([
        api.get("/commerce/products"),
        api.get("/commerce/categories"),
        api.get("/integrations/whatsapp")
      ]);
      setProducts(pRes.data.products || []);
      setCategories(cRes.data.categories || []);

      const wa = iRes.data.data || iRes.data;
      const verified = wa.catalogConnected === true && wa.catalogIdValid === true;
      setIsCatalogConnected(verified);
      setPermissionMissing(!!wa.permissionMissing);
      setCatalogIdValid(!!wa.catalogIdValid);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || "",
        price: product.price,
        sku: product.sku,
        imageUrl: product.imageUrl || "",
        categoryId: product.categoryId?._id || "",
        googleCategory: product.googleCategory || "",
        stock: product.stock || "",
        syncToMeta: product.syncStatus === 'synced'
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        description: "",
        price: "",
        sku: "PROD-" + Math.floor(Math.random() * 90000 + 10000),
        imageUrl: "",
        categoryId: "",
        googleCategory: "",
        stock: "100",
        syncToMeta: true
      });
    }
    setIsModalOpen(true);
    setImageSource("url");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, imageUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Strict Validation (Rule #10)
    if (!formData.googleCategory) return nicePrompt.error("Validation", "Please select a Category");
    if (!formData.imageUrl) return nicePrompt.error("Validation", "Please provide a public Image URL");
    if (formData.price <= 0) return nicePrompt.error("Validation", "Price must be greater than 0");

    try {
      if (editingProduct) {
        await api.put(`/commerce/products/${editingProduct._id}`, formData);
        nicePrompt.success("Success", "Product updated successfully");
      } else {
        await api.post("/commerce/products", formData);
        nicePrompt.success("Success", "Product created & synced successfully");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      nicePrompt.error("Error", err.response?.data?.error || "Operation failed");
    }
  };

  const handleSyncProduct = async (id) => {
    try {
      setSyncingId(id);
      const res = await api.post(`/commerce/sync-product/${id}`);
      if (res.data.success) {
        nicePrompt.success("Synced", "Product synced to Meta Catalog");
        fetchData();
      } else {
        nicePrompt.error("Sync Failed", res.data.message || "Failed to sync product");
      }
    } catch (err) {
      nicePrompt.error("Error", err.response?.data?.message || "Sync request failed");
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncingAll(true);
      const res = await api.post("/commerce/sync-all");
      if (res.data.success) {
        nicePrompt.success("Sync Complete", res.data.message);
        fetchData();
      }
    } catch (err) {
      nicePrompt.error("Error", err.response?.data?.message || "Batch sync failed");
    } finally {
      setSyncingAll(false);
    }
  };

  const handleRefreshStatuses = async () => {
    try {
      setLoading(true);
      const res = await api.post("/commerce/refresh-statuses");
      if (res.data.success) {
        nicePrompt.success("Refreshed", res.data.message);
        fetchData();
      }
    } catch (err) {
      nicePrompt.error("Error", "Failed to refresh statuses");
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromMeta = async () => {
    try {
      setImportingMeta(true);
      const res = await api.post("/commerce/import-products");
      if (res.data.success) {
        nicePrompt.success("Import Successful", res.data.message);
        fetchData();
      }
    } catch (err) {
      nicePrompt.error("Import Failed", err.response?.data?.error || "Failed to import products");
    } finally {
      setImportingMeta(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await api.delete(`/commerce/products/${id}`);
      nicePrompt.success("Deleted", "Product removed successfully");
      fetchData();
    } catch (err) {
      nicePrompt.error("Error", "Failed to delete product");
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = selectedCategory === "all" || p.categoryId?._id === selectedCategory;
    const matchesMetaCategory = selectedMetaCategory === "all" || p.googleCategory === selectedMetaCategory;

    return matchesSearch && matchesCategory && matchesMetaCategory;
  });

  return (
    <div className="p-6 md:p-8 space-y-8 bg-[#F8FAFC] min-h-screen font-poppins">
      {!loading && permissionMissing && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 p-6 rounded-[32px] flex items-center gap-4 shadow-sm"
        >
          <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
            <AlertCircle size={24} />
          </div>
          <div className="flex-1">
            <h4 className="text-red-900 font-bold text-lg">Meta Permission Not Granted</h4>
            <p className="text-red-700 font-medium">⚠️ Reconnect Meta with full permissions (business_management, catalog_management required) in the <a href="/whatsapp-commerce/catalog-sync" className="underline font-bold">Settings</a> page.</p>
          </div>
        </motion.div>
      )}

      {!loading && !permissionMissing && !catalogIdValid && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 p-6 rounded-[32px] flex items-center gap-4 shadow-sm"
        >
          <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
            <AlertCircle size={24} />
          </div>
          <div className="flex-1">
            <h4 className="text-amber-900 font-bold text-lg">No Catalog Found</h4>
            <p className="text-amber-700 font-medium">⚠️ No catalog found. Please create one in Meta Commerce Manager or use the One-Click connection in the <a href="/whatsapp-commerce/catalog-sync" className="underline font-bold">Catalog Sync</a> page.</p>
          </div>
        </motion.div>
      )}

      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Products Catalog</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage your native WhatsApp store inventory</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleImportFromMeta}
            disabled={importingMeta || !isCatalogConnected || permissionMissing || !catalogIdValid}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95
              ${(importingMeta || !isCatalogConnected || permissionMissing || !catalogIdValid) ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100"}
            `}
          >
            {importingMeta ? <RefreshCw className="animate-spin" size={20} /> : <Upload size={20} className="rotate-180" />}
            {importingMeta ? "Importing..." : "Sync from Meta"}
          </button>

          <button
            onClick={() => handleOpenModal()}
            disabled={!isCatalogConnected || permissionMissing || !catalogIdValid}
            className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 translate-y-0
              ${(!isCatalogConnected || permissionMissing || !catalogIdValid) ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 hover:-translate-y-0.5"}
            `}
          >
            <Plus size={20} /> Add New Product
          </button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Products", value: products.length, icon: Package, color: "blue" },
          { label: "Out of Stock", value: products.filter(p => p.stock <= 0).length, icon: AlertCircle, color: "amber" },
          { label: "Synced to Meta", value: products.filter(p => p.syncStatus === 'synced').length, icon: Zap, color: "emerald" },
          { label: "In Categories", value: categories.length, icon: ShoppingBag, color: "indigo" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-extrabold text-slate-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center bg-white/50 backdrop-blur-sm">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or SKU..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400 font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 border rounded-2xl text-sm font-extrabold transition-all shadow-sm active:scale-95 ${isFilterOpen ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <Filter size={18} className={isFilterOpen ? "text-blue-600" : "text-slate-400"} /> Filters
              {(selectedCategory !== 'all' || selectedMetaCategory !== 'all') && (
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              )}
            </button>

            {/* Filter Dropdown */}
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-72 bg-white rounded-[24px] shadow-2xl border border-slate-100 p-5 z-[100]"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Local Category</label>
                      <DensitySelector
                        value={selectedCategory}
                        onChange={(val) => setSelectedCategory(val)}
                        options={[
                          { label: "All Categories", value: "all" },
                          ...categories.map(c => ({ label: c.name, value: c._id }))
                        ]}
                        label=""
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Meta Industry</label>
                      <DensitySelector
                        value={selectedMetaCategory}
                        onChange={(val) => setSelectedMetaCategory(val)}
                        options={[
                          { label: "All Meta Industries", value: "all" },
                          ...PRODUCT_CATEGORIES
                        ]}
                        label=""
                      />
                    </div>

                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedCategory("all");
                          setSelectedMetaCategory("all");
                          setIsFilterOpen(false);
                        }}
                        className="flex-1 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setIsFilterOpen(false)}
                        className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-100"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleRefreshStatuses}
              disabled={loading}
              className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-all flex items-center gap-2 shadow-sm border border-blue-100/50"
              title="Fetch latest approval status from Meta"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              <span className="text-[10px] font-black uppercase tracking-widest">Status Update</span>
            </button>
          </div>
        </div>

        {/* Table/List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Product Info</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">SKU</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Category</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Inventory</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Sync Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Price</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-8 h-16 bg-slate-50/20"></td>
                  </tr>
                ))
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <Package size={48} className="text-slate-300 mb-4" />
                      <p className="text-lg font-bold text-slate-500">No products found</p>
                      <p className="text-sm">Try adding your first product to get started</p>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.map((product) => (
                <tr key={product._id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-[24px] bg-white flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm p-1 group-hover:shadow-md group-hover:-translate-y-0.5 transition-all">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-[20px]" />
                        ) : (
                          <ImageIcon size={28} className="text-slate-300" />
                        )}
                      </div>
                      <div>
                        <p className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors tracking-tight">{product.name}</p>
                        <p className="text-xs text-slate-500 font-medium line-clamp-1">{product.description || "No description provided"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold">
                      {product.sku}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-black text-slate-800 tracking-tight">
                        {product.categoryId?.name || "Uncategorized"}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                        Meta: {PRODUCT_CATEGORIES.find(c => c.value === product.googleCategory)?.label || "Other"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-sm font-bold ${product.stock <= 0 ? "text-red-500" : "text-slate-700"}`}>
                        {product.stock}
                      </span>
                      <div className="w-12 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={`h-full ${product.stock > 20 ? "bg-emerald-400" : "bg-amber-400"}`}
                          style={{ width: `${Math.min(100, product.stock)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      {/* Sync Status Badge */}
                      {product.syncStatus === 'synced' ? (
                        <div className="flex flex-col gap-1.5 items-center w-full">
                          {/* Main Meta Indicator */}
                          {product.metaStatus === 'approved' ? (
                            <div className="flex flex-col items-center">
                              <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                Live on WhatsApp
                              </span>
                              {product.metaProductId && (
                                <span className="text-[8px] font-mono text-slate-300 mt-1 uppercase tracking-tighter">ID: {product.metaProductId}</span>
                              )}
                            </div>
                          ) : product.metaStatus === 'pending' ? (
                            <span className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                              <RefreshCw size={10} className="animate-spin" />
                              Meta Reviewing
                            </span>
                          ) : product.metaStatus === 'rejected' ? (
                            <span className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                              <AlertCircle size={10} />
                              Meta Rejected
                            </span>
                          ) : (
                            <span className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                              <Zap size={10} className="fill-blue-500" />
                              Synced
                            </span>
                          )}
                        </div>
                      ) : (product.syncStatus === 'error' || product.syncStatus === 'failed') ? (
                        <span className="px-3 py-1.5 bg-rose-50 text-rose-500 border border-rose-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm cursor-help" title={product.syncError}>
                          <AlertCircle size={10} />
                          Sync Error
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 bg-slate-50 text-slate-400 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                          <Package size={10} />
                          Not Synced
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right font-extrabold text-slate-900">
                    {product.currency || "₹"}{product.price.toLocaleString()}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleSyncProduct(product._id)}
                        disabled={syncingId === product._id}
                        title="Force Sync to Meta"
                        className={`p-2.5 rounded-xl transition-all ${syncingId === product._id ? "text-slate-300 cursor-not-allowed" : "text-emerald-500 hover:bg-emerald-50"}`}
                      >
                        <Zap size={18} className={syncingId === product._id ? "animate-pulse" : ""} fill={product.syncStatus === 'synced' ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => handleOpenModal(product)}
                        className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(product._id)}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp Catalog Integration</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-slate-900 transition-all shadow-sm active:scale-90"
                >
                  <RefreshCw size={18} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh] custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Premium Silk Saree"
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 transition-all outline-none"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SKU (Retailer ID)</label>
                    <input
                      required
                      type="text"
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 transition-all outline-none"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                  <textarea
                    rows="2"
                    placeholder="Provide a brief product description..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 transition-all outline-none resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Price (INR)</label>
                    <input
                      required
                      type="number"
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 transition-all outline-none"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock</label>
                    <input
                      required
                      type="number"
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 transition-all outline-none"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Meta Category <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <select
                        required
                        className="w-full h-11 pl-4 pr-10 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 transition-all outline-none appearance-none cursor-pointer"
                        value={formData.googleCategory}
                        onChange={(e) => setFormData({ ...formData, googleCategory: e.target.value })}
                      >
                        <option value="">Select Category</option>
                        {PRODUCT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Image</label>
                    <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-100">
                      <button
                        type="button"
                        onClick={() => setImageSource("file")}
                        className={`px-3 py-1 text-[9px] font-black uppercase tracking-tighter rounded-md transition-all ${imageSource === 'file' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Upload Local
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageSource("url")}
                        className={`px-3 py-1 text-[9px] font-black uppercase tracking-tighter rounded-md transition-all ${imageSource === 'url' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Public URL
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      {imageSource === 'file' ? (
                        <div className="relative group">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="h-[52px] border-2 border-dashed border-slate-200 rounded-[18px] flex items-center justify-center gap-2.5 bg-slate-50/50 group-hover:border-blue-400 group-hover:bg-white transition-all">
                            <Plus size={16} className="text-slate-400 group-hover:text-blue-500" />
                            <span className="text-[12px] font-bold text-slate-500 group-hover:text-blue-600">
                              {formData.imageUrl?.startsWith('data:') ? 'Image Selected' : 'Tap to upload'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <input
                          type="text"
                          className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 transition-all outline-none"
                          placeholder="https://example.com/image.jpg"
                          value={formData.imageUrl?.startsWith('data:') ? '' : formData.imageUrl}
                          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        />
                      )}
                    </div>
                    {formData.imageUrl && (
                      <div className="w-11 h-11 rounded-xl border border-slate-100 overflow-hidden shrink-0 shadow-sm bg-white p-0.5">
                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-emerald-50/40 rounded-xl border border-emerald-100/50">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      id="syncToMeta"
                      className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                      checked={formData.syncToMeta}
                      onChange={(e) => setFormData({ ...formData, syncToMeta: e.target.checked })}
                    />
                  </div>
                  <label htmlFor="syncToMeta" className="flex-1 text-[11px] font-bold text-emerald-800 cursor-pointer">
                    Immediate Meta Catalog Sync
                  </label>
                  <Zap size={14} className="text-emerald-500 fill-current opacity-50" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 px-6 bg-slate-50 text-slate-500 border border-slate-100 rounded-xl text-sm font-bold hover:bg-slate-100 hover:text-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-3 px-6 bg-blue-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 hover:shadow-blue-200 hover:-translate-y-0.5 transition-all active:scale-95 active:translate-y-0"
                  >
                    {editingProduct ? 'Update Product' : 'Create & Sync'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
