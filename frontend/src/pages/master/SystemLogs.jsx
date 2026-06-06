import React, { useState, useEffect } from 'react';
import {
    Activity,
    Search,
    RefreshCw,
    AlertCircle,
    Info,
    AlertTriangle,
    Clock,
    User,
    Database,
    Eye,
    X,
    FileText
} from 'lucide-react';
import api from '../../api/api';

const SystemLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [filterType, setFilterType] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);

    const fetchLogs = async (p = 1) => {
        try {
            setLoading(true);
            console.log('🔍 [FRONTEND] Fetching system logs...');
            const res = await api.get(`/superadmin/system-logs?page=${p}&limit=50${filterType ? `&type=${filterType}` : ''}`);
            console.log('🔍 [FRONTEND] System logs API response:', res.data);

            // CORRECT: Extract logs from response.data.data.logs
            if (res.data.success && res.data.data && res.data.data.logs) {
                const logs = res.data.data.logs;
                const pagination = res.data.data.pagination || {};
                console.log('✅ [FRONTEND] System logs extracted:', logs.length);
                console.log('🔍 [FRONTEND] Pagination:', pagination);

                setLogs(Array.isArray(logs) ? logs : []);
                setTotal(pagination.total || 0);
            } else {
                console.error('❌ [FRONTEND] Invalid system logs API response:', res.data);
                setLogs([]);
                setTotal(0);
            }
        } catch (err) {
            console.error('❌ [FRONTEND] Failed to fetch system logs', err);
            setLogs([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs(page);
    }, [page, filterType]);

    const getIcon = (type) => {
        switch (type) {
            case 'error': return <AlertCircle className="text-rose-600" size={18} />;
            case 'warning': return <AlertTriangle className="text-amber-600" size={18} />;
            default: return <Info className="text-indigo-600" size={18} />;
        }
    };

    const getBg = (type) => {
        switch (type) {
            case 'error': return 'bg-rose-50 border-rose-100 text-rose-600';
            case 'warning': return 'bg-amber-50 border-amber-100 text-amber-600';
            default: return 'bg-indigo-50 border-indigo-100 text-indigo-600';
        }
    };

    if (loading && page === 1) {
        return (
            <div className="flex flex-col items-center justify-center p-32">
                <RefreshCw className="animate-spin text-indigo-600 mb-4" size={40} />
                <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Accessing System Kernel...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-[22px] font-bold text-slate-900 leading-snug">System Logs</h1>
                    <p className="text-sm font-normal text-slate-500 mt-1">Platform-wide event audit and diagnostic center</p>
                </div>
                <div className="flex items-center gap-4">
                    <select
                        value={filterType}
                        onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                        className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-medium text-sm shadow-[0px_4px_12px_rgba(0,0,0,0.05)] cursor-pointer"
                    >
                        <option value="">All Severities</option>
                        <option value="info">Info Only</option>
                        <option value="warning">Warnings</option>
                        <option value="error">Errors</option>
                    </select>
                    <button onClick={() => fetchLogs(page)} className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-600 transition-all shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white border border-slate-200 rounded-[12px] overflow-hidden shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Priority</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Event Message</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">User / Context</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {Array.isArray(logs) && logs.map((log) => (
                            <tr key={log._id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full w-fit text-xs font-medium border ${getBg(log.type)}`}>
                                        {getIcon(log.type)}
                                        <span className="capitalize">{log.type}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="max-w-md">
                                        <div className="font-semibold text-slate-800 text-[14px] leading-tight">{log.message}</div>
                                        {log.ip && <div className="font-semibold text-slate-400 text-[11px] mt-0.5 uppercase tracking-wider font-mono">IP: {log.ip}</div>}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {log.userId ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                                                {log.userId.name?.[0]?.toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-800 text-[14px]">{log.userId.name}</span>
                                                <span className="font-semibold text-slate-400 text-[11px] mt-0.5">{log.userId.email}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded">System Core</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="font-semibold text-slate-800 text-[14px]">
                                            {new Date(log.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">
                                            {new Date(log.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => setSelectedLog(log)}
                                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-all"
                                        title="View Details"
                                    >
                                        <FileText size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {logs.length === 0 && (
                    <div className="p-16 text-center">
                        <Database className="mx-auto text-slate-200 mb-4" size={48} />
                        <span className="text-slate-500 font-medium text-sm">No logs found matching current filters</span>
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
                        Back
                    </button>
                    <div className="px-4 text-xs font-black text-slate-400">Log Frame {page} / {Math.ceil(total / 50)}</div>
                    <button
                        disabled={logs.length < 50}
                        onClick={() => setPage(p => p + 1)}
                        className="px-6 py-3 bg-white border border-slate-200 rounded-[12px] text-xs font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-[0px_4px_12px_rgba(0,0,0,0.05)]"
                    >
                        Forward
                    </button>
                </div>
            )}

            {/* Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-2xl p-8 shadow-2xl">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-[12px] border ${getBg(selectedLog.type)}`}>
                                    {getIcon(selectedLog.type)}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Log Diagnostics</h2>
                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-none mt-1">ID: {selectedLog._id}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-slate-100 rounded-[12px] transition-all">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Event Message</label>
                                <div className="bg-slate-50 border border-slate-200 rounded-[12px] p-6 font-bold text-slate-800 text-sm">
                                    {selectedLog.message}
                                </div>
                            </div>

                            {selectedLog.metadata && (
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Metadata Attachment</label>
                                    <pre className="bg-slate-900 text-indigo-300 p-6 rounded-[12px] text-xs font-mono overflow-auto max-h-64 shadow-inner">
                                        {JSON.stringify(selectedLog.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}

                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Full Raw JSON</label>
                                <pre className="bg-slate-900 text-indigo-300 p-6 rounded-[12px] text-xs font-mono overflow-auto max-h-64 shadow-inner">
                                    {JSON.stringify(selectedLog, null, 2)}
                                </pre>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Context Origin</label>
                                    <div className="bg-slate-50 border border-slate-200 rounded-[12px] p-3 text-xs font-bold text-slate-600">
                                        {selectedLog.userId?.email || 'SYSTEM_KERNEL'}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Origin IP</label>
                                    <div className="bg-slate-50 border border-slate-200 rounded-[12px] p-3 text-xs font-bold text-slate-600">
                                        {selectedLog.ip || 'INTERNAL'}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedLog(null)}
                                className="w-full py-4 bg-indigo-600 text-white font-black rounded-[12px] text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all mt-4"
                            >
                                Close Diagnostics
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemLogs;
