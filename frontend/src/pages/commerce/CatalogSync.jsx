import React, { useState, useEffect } from "react";
import {
  Zap,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  AlertTriangle,
  ExternalLink,
  Info
} from "lucide-react";
import api from "../../api/api";
import { motion } from "framer-motion";
import nicePrompt from "../../components/UI/NicePrompt";

export default function CatalogSync() {
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState({
    total: 0,
    synced: 0,
    errors: 0,
    catalogId: null,
    catalogName: null,
    catalogConnected: false,
    isWhatsAppConnected: false,
    isCatalogLinked: false,
    isConnected: false,
    catalogIdValid: true,
    permissionMissing: false
  });
  const [manualId, setManualId] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [logs, setLogs] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("products"); // "products" or "orders"

  useEffect(() => {
    fetchStatus();
    fetchSyncLogs();
  }, []);

  const fetchStatus = async () => {
    try {
      const pRes = await api.get("/commerce/products");
      const iRes = await api.get("/integrations/whatsapp");

      const products = pRes.data.products || [];
      const waData = iRes.data.data || iRes.data;
      const wa = waData.whatsapp || waData;

      const isWhatsAppConnected = wa.status === 'connected' || wa.connected === true;

      const catalogIdValid = wa.catalogIdValid !== false;
      const permissionMissing = !!wa.permissionMissing;
      const verifiedConnected = wa.catalogConnected === true && catalogIdValid && !permissionMissing;

      setStatus({
        total: products.length,
        synced: products.filter(p => p.syncStatus === 'synced').length,
        errors: products.filter(p => p.syncStatus === 'error' || p.syncStatus === 'failed').length,
        catalogId: verifiedConnected ? wa.catalogId : null,
        catalogName: verifiedConnected ? wa.catalogName : null,
        catalogConnected: verifiedConnected,
        isWhatsAppConnected,
        isCatalogLinked: verifiedConnected,
        isConnected: isWhatsAppConnected,
        catalogIdValid,
        permissionMissing
      });

      const errorLogs = products
        .filter(p => p.syncStatus === 'error' || p.syncStatus === 'failed')
        .map(p => ({
          time: new Date(p.updatedAt).toLocaleTimeString(),
          type: "error",
          message: `Product [${p.sku}] - ${p.syncError}`
        }));
      setLogs(errorLogs);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSyncLogs = async () => {
    try {
      const res = await api.get("/commerce/sync-logs");
      setSyncLogs(res.data.logs || []);
    } catch (err) {
      console.error("Failed to fetch sync logs:", err);
    }
  };

  const handleConnectCatalog = async () => {
    try {
      setConnecting(true);
      setLogs(prev => [{ time: new Date().toLocaleTimeString(), type: "info", message: "Connecting to Meta Business Account..." }, ...prev]);

      const res = await api.post("/commerce/connect-catalog");

      if (res.data.success) {
        nicePrompt.success("Catalog Connected", `Store Catalog [${res.data.catalogName || "Auto Catalog"}] linked successfully.`);
        fetchStatus();
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || "";
      nicePrompt.error("Connection Failed", msg);

      // Auto-expand manual mode if discovery is blocked by permissions
      if (msg.includes("manually")) {
        setIsManualMode(true);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleManualConnect = async () => {
    if (!manualId.trim()) return nicePrompt.error("Required", "Please enter a Catalog ID");

    try {
      setSavingManual(true);
      setLogs(prev => [{ time: new Date().toLocaleTimeString(), type: "info", message: `Connecting manually to ID: ${manualId}...` }, ...prev]);

      const res = await api.post("/commerce/manual-catalog", { catalogId: manualId });

      if (res.data.success) {
        nicePrompt.success("Connected", `Catalog [${res.data.catalogName}] linked successfully.`);
        setIsManualMode(false);
        setManualId("");
        fetchStatus();
      }
    } catch (err) {
      const errorData = err.response?.data;
      const msg = errorData?.message || "Invalid Catalog ID or Permissions";
      const details = errorData?.details ? `\nBusiness: ${errorData.details.business ? '✅' : '❌'}\nCatalog Mgmt: ${errorData.details.catalog ? '✅' : '❌'}` : "";

      nicePrompt.error("Connection Failed", msg + details);

      setLogs(prev => [{
        time: new Date().toLocaleTimeString(),
        type: "error",
        message: `Connection Failed: ${msg}`
      }, ...prev]);
    } finally {
      setSavingManual(false);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      setLogs(prev => [{ time: new Date().toLocaleTimeString(), type: "info", message: "Starting batch sync to Meta Catalog..." }, ...prev]);

      const res = await api.post("/commerce/sync-all");

      if (res.data.success) {
        nicePrompt.success("Sync Complete", `Successfully synced products.`);
        fetchStatus();
      }
    } catch (err) {
      const msg = err.response?.data?.message || "";
      let finalMsg = "Failed to batch sync products";
      if (msg.includes("(#200)") || msg.includes("Permissions error")) {
        finalMsg = "Permission Denied: Your token has access to the Catalog but lacks 'Manage' rights. Please add 'Manage Catalogue' permission to your System User in Meta Business Settings.";
      }
      nicePrompt.error("Sync Failed", finalMsg);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-[#F8FAFC] min-h-screen font-poppins">
      {status.permissionMissing && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 p-6 rounded-[32px] flex items-center gap-4 shadow-sm mb-4"
        >
          <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <h4 className="text-red-900 font-bold text-lg">Meta Permission Not Granted</h4>
            <p className="text-red-700 font-medium">⚠️ Reconnect Meta with full permissions (business_management, catalog_management required) in the Settings page.</p>
          </div>
        </motion.div>
      )}

      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Zap className="text-emerald-500" /> Catalog Sync
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Meta Commerce Manager Bridge</p>
        </div>

        <button
          onClick={handleSyncAll}
          disabled={syncing || !status.catalogConnected || status.permissionMissing}
          className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95
            ${(syncing || !status.catalogConnected || status.permissionMissing) ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100"}
          `}
        >
          {syncing ? <RefreshCw className="animate-spin" size={20} /> : <Zap size={20} />}
          {syncing ? "Synchronizing..." : "Sync All Products to Meta"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-100/50 space-y-8"
        >
          <h3 className="text-xl font-extrabold text-slate-900">Connection Status</h3>

          <div className="space-y-4">
            <div className={`p-6 rounded-[24px] border transition-all flex items-center gap-4 ${status.isWhatsAppConnected ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
              <div className={`p-3 rounded-2xl ${status.isWhatsAppConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                {status.isWhatsAppConnected ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
              </div>
              <div>
                <p className={`text-sm font-bold ${status.isWhatsAppConnected ? 'text-emerald-800' : 'text-red-800'}`}>WhatsApp Linked</p>
                <p className="text-xs text-slate-500 font-medium">Official Meta API Status</p>
              </div>
            </div>

            <div className={`p-6 rounded-[24px] border transition-all flex flex-col gap-4 ${status.catalogConnected ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${status.catalogConnected ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                  <Zap size={24} />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${status.catalogConnected ? 'text-blue-800' : 'text-slate-600'}`}>
                    {status.catalogConnected ? (status.catalogName || 'Catalog Synchronized') : 'Catalog Not Connected'}
                  </p>
                  {status.catalogConnected && status.catalogId ? (
                    <p className="text-[10px] text-slate-400 font-mono tracking-tighter truncate max-w-[150px]">
                      ID: {status.catalogId}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 font-medium">{isManualMode ? "Enter ID below" : "Discovery needed"}</p>
                  )}
                </div>
                {!status.catalogConnected && !isManualMode && (
                  <button
                    onClick={handleConnectCatalog}
                    disabled={connecting || !status.isWhatsAppConnected}
                    className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 disabled:bg-slate-200 disabled:shadow-none"
                  >
                    {connecting ? <RefreshCw className="animate-spin" size={18} /> : <span>Connect</span>}
                  </button>
                )}
              </div>

              {!status.catalogConnected && (
                <div className="pt-2">
                  {!isManualMode ? (
                    <button
                      onClick={() => setIsManualMode(true)}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-widest flex items-center gap-1"
                    >
                      <Info size={12} /> Input Catalog ID Manually
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={manualId}
                          onChange={(e) => setManualId(e.target.value)}
                          placeholder="Enter Meta Catalog ID"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleManualConnect}
                          disabled={savingManual || !manualId.trim()}
                          className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 disabled:bg-slate-200"
                        >
                          {savingManual ? "Verifying..." : "Verify & Connect"}
                        </button>
                        <button
                          onClick={() => setIsManualMode(false)}
                          className="px-4 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-50">
            <h4 className="text-sm font-bold text-slate-900 mb-4">Quick Stats</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total</p>
                <p className="text-xl font-black text-slate-900">{status.total}</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl">
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Synced</p>
                <p className="text-xl font-black text-emerald-600">{status.synced}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-[#0F172A] rounded-[32px] overflow-hidden shadow-2xl border border-slate-800 flex flex-col h-[500px]">
            <div className="bg-slate-800/50 px-6 py-4 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setActiveTab("products")}
                  className={`text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'products' ? 'text-blue-400 border-b-2 border-blue-400 pb-1' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Product Sync Logs
                </button>
                <button 
                  onClick={() => setActiveTab("orders")}
                  className={`text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'orders' ? 'text-blue-400 border-b-2 border-blue-400 pb-1' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Captured Order Logs
                </button>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/40" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-mono text-[13px] space-y-4 scrollbar-hide">
              {activeTab === 'products' ? (
                syncLogs.filter(l => l.sku !== 'ORDER').length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                    <Terminal size={32} className="opacity-20" />
                    <p className="italic">No product sync activity detected.</p>
                  </div>
                ) : (
                  syncLogs.filter(l => l.sku !== 'ORDER').map((log, i) => (
                    <div key={log._id || i} className="flex gap-4 group animate-fadeIn">
                      <span className="text-slate-600 select-none min-w-[70px]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={`font-bold w-6 text-center ${log.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {log.status === 'success' ? "✅" : "❌"}
                      </span>
                      <div className="flex-1">
                        <p className={log.status === 'error' ? 'text-red-300' : 'text-slate-300 font-bold'}>
                          {log.operation.toUpperCase()} : {log.productName || log.sku}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{log.message}</p>
                      </div>
                    </div>
                  ))
                )
              ) : (
                syncLogs.filter(l => l.sku === 'ORDER').length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                    <ShoppingBag size={32} className="opacity-20" />
                    <p className="italic">No orders captured recently.</p>
                  </div>
                ) : (
                  syncLogs.filter(l => l.sku === 'ORDER').map((log, i) => (
                    <div key={log._id || i} className="flex gap-4 group animate-fadeIn border-l-2 border-blue-500/30 pl-4 py-1">
                      <span className="text-slate-600 select-none min-w-[70px]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="text-blue-400 font-bold w-6 text-center">📦</span>
                      <div className="flex-1">
                        <p className="text-blue-200 font-black tracking-tight">
                          ORDER CAPTURED
                        </p>
                        <p className="text-[11px] text-slate-300 mt-0.5">{log.message}</p>
                        {log.details?.amount && (
                           <p className="text-[10px] text-emerald-400 font-bold mt-1">Value: ₹{log.details.amount.toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>

            <div className="bg-slate-900 px-6 py-3 flex items-center justify-between border-t border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {syncing ? "SYNCING..." : "READY FOR SYNC"}
              </span>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest"
              >
                Clear Logs
              </button>
            </div>
          </div>

          <div className="bg-blue-600 rounded-[24px] p-6 text-white flex items-center justify-between shadow-xl shadow-blue-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl">
                <ExternalLink size={24} />
              </div>
              <div>
                <h4 className="font-bold">Open Meta Manager</h4>
                <p className="text-xs text-blue-100">Manage your product inventory directly on Facebook</p>
              </div>
            </div>
            <a
              href={status.catalogId ? `https://business.facebook.com/commerce_manager/${status.catalogId}` : "https://business.facebook.com/commerce"}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-2 bg-white text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors"
            >
              Open Meta Manager
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}