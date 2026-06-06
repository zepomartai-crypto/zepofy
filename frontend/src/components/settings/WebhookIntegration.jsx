import React, { useState, useEffect } from 'react';
import { FiGlobe, FiCopy, FiRefreshCw, FiActivity, FiZap, FiCheckCircle, FiAlertCircle, FiLayers, FiInfo, FiTerminal } from 'react-icons/fi';
import api from '../../api/api';

const WebhookIntegration = ({ successMessage, errorMessage, setSuccessMessage, setErrorMessage, activeTab }) => {
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [logs, setLogs] = useState([]);
    const [config, setConfig] = useState({
        webhookUrl: '',
        webhookVerifyToken: '',
        lastTestStatus: 'pending',
        lastTestAt: null,
        lastTestResponseTime: 0
    });

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await api.get('/webhook-config/config');
            if (res.data.success && res.data.data) {
                setConfig(res.data.data);
            }

            // Fetch recent logs
            const logsRes = await api.get('/webhook-config/logs');
            if (logsRes.data.success) {
                setLogs(logsRes.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch webhook config:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const handleCopy = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setSuccessMessage('Copied to clipboard!');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const handleTest = async () => {
        setTesting(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const res = await api.post('/webhook-config/test');
            if (res.data.success) {
                setSuccessMessage('Webhook test signal sent!');
                fetchConfig();
            } else {
                setErrorMessage(res.data.error || 'Webhook test failed');
            }
        } catch (err) {
            setErrorMessage('Webhook test failed');
        } finally {
            setTesting(false);
        }
    };

    const events = [
        { name: 'messages', desc: 'Triggered when a customer sends a new message to your WABA number.' },
        { name: 'message_status', desc: 'Updates for sent, delivered, and read status of your outbound messages.' },
        { name: 'template_status', desc: 'Notifies when your Meta message templates are approved or rejected.' },
        { name: 'order_update', desc: 'Real-time updates from linked stores (WooCommerce/Shopify).' }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center p-24">
                <FiRefreshCw className="w-10 h-10 text-purple-500 animate-spin" />
            </div>
        );
    }

    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
    const displayUrl = `${serverUrl}/api/webhook/whatsapp/${config.userId || 'USER_ID'}`;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header / Intro */}
            <div className="relative overflow-hidden bg-white rounded-[12px] p-8 border border-slate-200 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <FiLayers size={120} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-purple-600 text-white rounded-[12px] shadow-lg shadow-purple-200">
                                <FiGlobe size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Webhooks</h2>
                        </div>
                        <p className="text-slate-600 leading-relaxed font-medium">
                            Webhooks are automatically managed. Connect your WhatsApp or Store account, and we'll handle the real-time event routing.
                        </p>
                    </div>
                    <div className="flex-shrink-0">
                        <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-sm font-bold border transition-all ${config.lastTestStatus === 'success'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]'
                            : 'bg-amber-50 text-amber-700 border-amber-200 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]'
                            }`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${config.lastTestStatus === 'success' ? 'bg-blue-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`}></div>
                            {config.lastTestStatus === 'success' ? 'Functional' : 'Verifying...'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Status & Test Card */}
                <div className="lg:col-span-12 bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <FiActivity className="text-blue-500" /> Webhook Health
                        </h3>
                        <button
                            onClick={handleTest}
                            disabled={testing}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-[12px] text-xs font-bold hover:bg-purple-600 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                        >
                            {testing ? <FiRefreshCw className="animate-spin" /> : <FiZap />}
                            {testing ? "Testing..." : "Test Webhook Signal"}
                        </button>
                    </div>
                    <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-1">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Last Heartbeat</div>
                                <div className="font-bold text-slate-900">
                                    {config.lastTestAt ? new Date(config.lastTestAt).toLocaleTimeString() : 'No tests yet'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Base Path</div>
                                <div className="font-mono text-slate-600 text-xs font-bold truncate">/api/webhook/*</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Response Time</div>
                                <div className="font-bold text-slate-900">{config.lastTestResponseTime || 0}ms</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Event Logs Card */}
                <div className="lg:col-span-8 bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <FiTerminal className="text-slate-500" /> Last Webhook Events
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80">
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Source</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {logs.length > 0 ? (
                                    logs.map((log) => (
                                        <tr key={log._id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-900">{log.topic || 'Inbound'}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">{log.eventType || 'Generic Event'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.source === 'whatsapp' ? 'bg-blue-50 text-blue-600' :
                                                    log.source === 'woocommerce' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                                                    }`}>
                                                    {log.source}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                                                    <span className="text-xs font-bold text-slate-700 capitalize">{log.status}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-xs font-medium text-slate-500">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 bg-slate-50 rounded-[12px] flex items-center justify-center text-slate-300">
                                                    <FiActivity size={24} />
                                                </div>
                                                <p className="text-xs font-bold text-slate-400 italic">Listening for inbound events...</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Supported Events Card */}
                <div className="lg:col-span-4 bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <FiZap className="text-amber-500" /> Supported Events
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                        {events.map((event, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 rounded-[12px] border border-slate-200 hover:border-purple-200 transition-colors group">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-slate-900 font-mono bg-white px-2 py-1 rounded-lg shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 group-hover:text-purple-600">{event.name}</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
                                </div>
                                <p className="text-[11px] text-slate-500 font-bold leading-relaxed">{event.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WebhookIntegration;
