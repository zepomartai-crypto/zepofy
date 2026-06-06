import React, { useState, useEffect } from 'react';
import {
    FiShoppingBag, FiCheckCircle, FiXCircle, FiZap,
    FiExternalLink, FiInfo, FiRefreshCw, FiDatabase,
    FiTerminal
} from 'react-icons/fi';
import { useIntegration } from '../../context/IntegrationContext';
import api from '../../api/api';
import nicePrompt from '../UI/NicePrompt';

export default function WhatsAppCommerceIntegration({ setSuccessMessage, setErrorMessage }) {
    const { catalogConnected, catalogId, refreshStatus, loading: contextLoading } = useIntegration();
    const [connecting, setConnecting] = useState(false);
    const [waIntegration, setWaIntegration] = useState(null);
    const [loading, setLoading] = useState(true);
    const [manualId, setManualId] = useState("");
    const [isManualMode, setIsManualMode] = useState(false);
    const [savingManual, setSavingManual] = useState(false);

    useEffect(() => {
        fetchWaDetails();
    }, []);

    const fetchWaDetails = async () => {
        try {
            setLoading(true);
            const res = await api.get('/integrations/whatsapp');
            setWaIntegration(res.data.data || res.data);
        } catch (err) {
            console.error("Failed to fetch WhatsApp details:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleConnectCatalog = async () => {
        try {
            setConnecting(true);
            const res = await api.post("/commerce/connect-catalog");
            if (res.data.success) {
                nicePrompt.success("Success", "WhatsApp Catalog linked successfully!");
                refreshStatus();
            }
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || "";
            nicePrompt.error("Error", msg);
            // If discovery fails, offer manual mode
            if (msg.toLowerCase().includes("manually") || msg.toLowerCase().includes("not found")) {
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
            const res = await api.post("/commerce/manual-catalog", { catalogId: manualId });

            if (res.data.success) {
                nicePrompt.success("Connected", `Catalog [${res.data.catalogName}] linked successfully.`);
                setIsManualMode(false);
                setManualId("");
                refreshStatus();
            }
        } catch (err) {
            nicePrompt.error("Connection Failed", err.response?.data?.message || "Invalid Catalog ID or Permissions");
        } finally {
            setSavingManual(false);
        }
    };

    const handleDisconnectCatalog = async () => {
        const confirm = await nicePrompt.confirm("Disconnect Catalog", "Are you sure you want to un-link your Meta Product Catalog? This will disable all commerce features.");
        if (!confirm) return;

        try {
            setConnecting(true); // Re-use connecting state for loading
            const res = await api.post("/commerce/disconnect-catalog");
            if (res.data.success) {
                nicePrompt.success("Disconnected", "Catalog un-linked successfully.");
                refreshStatus();
            }
        } catch (err) {
            nicePrompt.error("Error", err.response?.data?.error || "Failed to disconnect catalog");
        } finally {
            setConnecting(false);
        }
    };

    if (loading || contextLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <FiRefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Synchronizing Security...</p>
            </div>
        );
    }

    const isWaConnected = waIntegration?.status === 'connected' || waIntegration?.whatsapp?.status === 'connected';

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-poppins">
            {/* Header Card */}
            <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-xl shadow-slate-100/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[28px] shadow-lg shadow-emerald-200 flex items-center justify-center text-white">
                            <FiShoppingBag size={36} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">WhatsApp Commerce</h2>
                            <p className="text-slate-500 font-medium text-sm mt-1">Connect your Meta Product Catalog for interactive shopping.</p>
                        </div>
                    </div>

                    <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border font-bold text-[11px] tracking-widest uppercase ${catalogConnected ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${catalogConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        {catalogConnected ? 'Verified Link' : 'Not Connected'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Connection Step Card */}
                <div className="bg-white rounded-[28px] p-7 border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <FiZap className="text-blue-600" /> Connection Logic
                    </h3>

                    <div className="space-y-4">
                        <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isWaConnected ? 'bg-blue-50/50 border-blue-100' : 'bg-red-50/50 border-red-100'}`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isWaConnected ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                                {isWaConnected ? <FiCheckCircle size={20} /> : <FiXCircle size={20} />}
                            </div>
                            <div className="flex-1">
                                <p className="text-[13px] font-bold text-slate-900">WhatsApp Business API</p>
                                <p className="text-[11px] text-slate-500 font-medium">{isWaConnected ? 'Core API Connected' : 'Connection Required'}</p>
                            </div>
                        </div>

                        <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${catalogConnected ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${catalogConnected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                <FiDatabase size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold text-slate-900">Meta Product Catalog</p>
                                <p className="text-[11px] text-slate-500 font-medium truncate">{catalogId ? `ID: ${catalogId}` : 'No catalog linked'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {!catalogConnected ? (
                            !isManualMode ? (
                                <div className="space-y-3">
                                    <button
                                        onClick={handleConnectCatalog}
                                        disabled={connecting || !isWaConnected}
                                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-2xl font-bold font-poppins shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-3"
                                    >
                                        {connecting ? <FiRefreshCw className="animate-spin" /> : <FiZap />}
                                        {connecting ? 'Discovering Catalog...' : 'Auto-Connect Catalog'}
                                    </button>
                                    <button
                                        onClick={() => setIsManualMode(true)}
                                        className="w-full py-2 text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        <FiInfo size={14} /> Connect Manually using Catalog ID
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3 p-1 animate-in fade-in zoom-in duration-300">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={manualId}
                                            onChange={(e) => setManualId(e.target.value)}
                                            placeholder="Enter Meta Catalog ID"
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all shadow-inner"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleManualConnect}
                                            disabled={savingManual || !manualId.trim()}
                                            className="flex-1 py-3.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:bg-slate-200 shadow-lg shadow-blue-100 transition-all active:scale-95"
                                        >
                                            {savingManual ? "Verifying..." : "Verify & Connect"}
                                        </button>
                                        <button
                                            onClick={() => setIsManualMode(false)}
                                            className="px-5 py-3.5 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )
                        ) : (
                            <button
                                onClick={handleDisconnectCatalog}
                                disabled={connecting}
                                className="w-full py-4 bg-white hover:bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl font-bold font-poppins active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                {connecting ? <FiRefreshCw className="animate-spin" /> : <FiXCircle />}
                                {connecting ? 'Disconnecting...' : 'Disconnect Catalog'}
                            </button>
                        )}
                    </div>

                    {!isWaConnected && (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                            <FiInfo className="text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-amber-700 font-semibold leading-relaxed">
                                You must connect your WhatsApp Business API first in the "WhatsApp Business" tab before linking a commerce catalog.
                            </p>
                        </div>
                    )}

                    {/* Step-by-step Guide */}
                    <div className="pt-6 border-t border-slate-50 space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <FiTerminal size={12} /> How to get Catalog ID?
                        </h4>
                        <div className="space-y-3">
                            {[
                                { step: "01", text: "Go to Meta Commerce Manager", link: "https://business.facebook.com/commerce_manager" },
                                { step: "02", text: "Select your business and Catalog" },
                                { step: "03", text: "Copy the ID from the URL or Catalog Settings" }
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <span className="text-[9px] font-black text-blue-600 bg-blue-50 w-6 h-6 rounded flex items-center justify-center shrink-0">{item.step}</span>
                                    {item.link ? (
                                        <a href={item.link} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-1.5 underline decoration-slate-200 underline-offset-4">
                                            {item.text} <FiExternalLink size={10} />
                                        </a>
                                    ) : (
                                        <span className="text-[11px] font-bold text-slate-600">{item.text}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Info Card */}
                <div className="bg-slate-900 rounded-[28px] p-7 text-white space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />

                    <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                        <FiTerminal /> System Intelligence
                    </h3>

                    <div className="space-y-5">
                        <div className="space-y-1.5">
                            <p className="text-sm font-bold tracking-tight">Interactive Shopping</p>
                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                Connect your catalog to enable "View Catalog" buttons in your templates and multi-product messages in flows.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <p className="text-sm font-bold tracking-tight">Real-time Catalog</p>
                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                Once connected, you can sync products from your local database directly to Meta Commerce Manager.
                            </p>
                        </div>

                        <a
                            href="https://business.facebook.com/commerce_manager"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-blue-400 font-bold text-[11px] hover:text-blue-300 transition-colors pt-2 group"
                        >
                            Open Meta Commerce Manager <FiExternalLink className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
