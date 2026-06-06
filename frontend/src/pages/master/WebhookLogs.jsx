import React, { useState, useEffect } from 'react';
import {
    Activity,
    Search,
    Filter,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Clock,
    Globe,
    Database,
    Eye,
    ArrowRight,
    MessageSquare,
    ShoppingCart,
    X
} from 'lucide-react';
import api from '../../api/api';

const WebhookLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);

    const fetchLogs = async (p = 1) => {
        try {
            setLoading(true);
            const res = await api.get(`/superadmin/webhooks?page=${p}&limit=50`);
            console.log('🔍 [FRONTEND] Webhook logs API response:', res.data);

            // CORRECT: Extract logs from response.data.data.logs
            if (res.data.success && res.data.data && res.data.data.logs) {
                const logs = res.data.data.logs;
                const pagination = res.data.data.pagination || {};
                console.log('✅ [FRONTEND] Webhook logs extracted:', logs.length);
                console.log('🔍 [FRONTEND] Pagination:', pagination);

                setLogs(Array.isArray(logs) ? logs : []);
                setTotal(pagination.total || 0);
            } else {
                console.error('❌ [FRONTEND] Invalid webhook logs API response:', res.data);
                setLogs([]);
                setTotal(0);
            }
        } catch (err) {
            console.error('❌ [FRONTEND] Failed to fetch webhook logs', err);
            setLogs([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    const viewLogDetails = (log) => {
        setSelectedLog(log);
        setShowDetailsModal(true);
    };

    useEffect(() => {
        fetchLogs(page);
    }, [page]);

    if (loading && page === 1) {
        return (
            <div className="flex flex-col items-center justify-center p-32">
                <RefreshCw className="animate-spin text-indigo-600 mb-4" size={40} />
                <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Streaming Audit Logs...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-[22px] font-bold text-slate-900 leading-snug">Webhook Logs</h1>
                    <p className="text-sm font-normal text-slate-500 mt-1">Real-time monitoring of all incoming and outgoing webhooks</p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => fetchLogs(page)} className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-600 transition-all shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-[12px] overflow-hidden shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">Source & Topic</th>
                            <th className="px-6 py-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">Tenant</th>
                            <th className="px-6 py-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                            <th className="px-6 py-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {Array.isArray(logs) && logs.map((log) => (
                            <tr key={log._id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${log.source === 'whatsapp' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                                            log.source === 'woocommerce' ? 'bg-orange-50 border-orange-100 text-orange-600' :
                                                'bg-indigo-50 border-indigo-100 text-indigo-600'
                                            }`}>
                                            {log.source === 'whatsapp' ? <MessageSquare size={16} /> :
                                                log.source === 'woocommerce' ? <ShoppingCart size={16} /> :
                                                    <Globe size={16} />}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-900 leading-tight capitalize">{log.source}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{log.topic || 'delivery.event'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-900">{log.userId?.name || 'Unknown'}</span>
                                        <span className="text-xs text-slate-500">{log.userId?.email || 'N/A'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${log.status === 'success' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-rose-50 border-rose-100 text-rose-700'
                                        }`}>
                                        {log.status === 'success' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                        {log.status === 'success' ? 'Success' : 'Failed'}
                                    </div>
                                    {log.error && <p className="text-xs text-rose-500 mt-1 line-clamp-1 max-w-[150px]" title={log.error}>{log.error}</p>}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="text-sm text-slate-900 font-medium">
                                            {new Date(log.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {new Date(log.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => viewLogDetails(log)}
                                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-all"
                                        title="View Details"
                                    >
                                        <Eye size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {(!Array.isArray(logs) || logs.length === 0) && (
                    <div className="p-24 text-center">
                        <Database className="mx-auto text-slate-100 mb-6" size={64} />
                        <span className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">No logs detected in current cycle</span>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {total > 50 && (
                <div className="flex justify-center items-center gap-4 py-8">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-6 py-3 bg-white border border-slate-200 rounded-[12px] text-xs font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-[0px_4px_12px_rgba(0,0,0,0.05)]"
                    >
                        Previous
                    </button>
                    <div className="px-4 text-xs font-black text-slate-400">Page {page} of {Math.ceil(total / 50)}</div>
                    <button
                        disabled={!Array.isArray(logs) || logs.length < 50}
                        onClick={() => setPage(p => p + 1)}
                        className="px-6 py-3 bg-white border border-slate-200 rounded-[12px] text-xs font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-[0px_4px_12px_rgba(0,0,0,0.05)]"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Log Details Modal */}
            {showDetailsModal && selectedLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[12px] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">Webhook Log Details</h2>
                                <button
                                    onClick={() => setShowDetailsModal(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Flow Source</label>
                                    <div className="mt-1 flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedLog.source === 'whatsapp' ? 'bg-blue-50 text-blue-600' :
                                            selectedLog.source === 'woocommerce' ? 'bg-orange-50 text-orange-600' :
                                                'bg-indigo-50 text-indigo-600'
                                            }`}>
                                            {selectedLog.source === 'whatsapp' ? <MessageSquare size={16} /> :
                                                selectedLog.source === 'woocommerce' ? <ShoppingCart size={16} /> :
                                                    <Globe size={16} />}
                                        </div>
                                        <span className="font-semibold text-slate-900">{selectedLog.source}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</label>
                                    <div className="mt-1">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${selectedLog.status === 'success' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                                            }`}>
                                            {selectedLog.status === 'success' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                            {selectedLog.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Associated Tenant</label>
                                <div className="mt-1">
                                    <div className="font-semibold text-slate-900">{selectedLog.userId?.name || 'Unknown'}</div>
                                    <div className="text-sm text-slate-500">{selectedLog.userId?.email || 'N/A'}</div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Timestamp</label>
                                <div className="mt-1 text-sm text-slate-700">
                                    {new Date(selectedLog.createdAt).toLocaleString()}
                                </div>
                            </div>

                            {selectedLog.topic && (
                                <div>
                                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Topic</label>
                                    <div className="mt-1 text-sm text-slate-700">{selectedLog.topic}</div>
                                </div>
                            )}

                            {selectedLog.error && (
                                <div>
                                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Error</label>
                                    <div className="mt-1 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                                        <p className="text-sm text-rose-700 font-mono">{selectedLog.error}</p>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Raw Payload</label>
                                <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                    <pre className="text-xs text-slate-700 font-mono overflow-x-auto">
                                        {JSON.stringify(selectedLog.payload || selectedLog, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WebhookLogs;
