
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Loader2, TrendingUp } from 'lucide-react';
import api from '../api/api';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const DashboardGraph = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState(7); // 7 for Live, 30 for History

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/superadmin/growth?range=${range}`);
            if (res.data.success) {
                setStats(res.data.data);
            }
        } catch (err) {
            console.error("Failed to load graph data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [range]);

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
                align: 'end',
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    font: {
                        family: "'Inter', sans-serif",
                        size: 11,
                        weight: 500
                    },
                    color: '#64748b'
                }
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleColor: '#f8fafc',
                bodyColor: '#f8fafc',
                padding: 10,
                cornerRadius: 8,
                displayColors: true,
                usePointStyle: true,
                callbacks: {
                    label: function (context) {
                        return ` ${context.dataset.label}: ${context.raw}`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                    drawBorder: false
                },
                ticks: {
                    font: {
                        family: "'Inter', sans-serif",
                        size: 10
                    },
                    color: '#94a3b8'
                }
            },
            y: {
                grid: {
                    borderDash: [4, 4],
                    color: '#f1f5f9',
                    drawBorder: false
                },
                ticks: {
                    font: {
                        family: "'Inter', sans-serif",
                        size: 10
                    },
                    color: '#94a3b8',
                    stepSize: 1
                },
                beginAtZero: true
            }
        },
        interaction: {
            mode: 'index',
            intersect: false,
        },
        maintainAspectRatio: false
    };

    const data = {
        labels: stats?.labels || [],
        datasets: [
            {
                label: 'New Users',
                data: stats?.users || [],
                borderColor: '#6366f1', // Indigo 500
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            },
            {
                label: 'Messages Sent',
                data: stats?.messages || [],
                borderColor: '#10b981', // Emerald 500
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            },
            {
                label: 'Campaigns',
                data: stats?.campaigns || [],
                borderColor: '#f97316', // Orange 500
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#f97316',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }
        ]
    };

    return (
        <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] w-full h-[400px] flex flex-col relative overflow-hidden group hover:shadow-md transition-all duration-300">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                            <TrendingUp size={16} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">Infrastructure Growth</h2>
                    </div>
                    <p className="text-xs text-slate-500 font-medium ml-9">
                        {range === 7 ? 'Real-time 7-day performance tracking' : 'Historical 30-day usage analysis'}
                    </p>
                </div>

                {/* Toggle */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setRange(7)}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${range === 7
                            ? 'bg-white text-indigo-600 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]'
                            : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        LIVE
                    </button>
                    <button
                        onClick={() => setRange(30)}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${range === 30
                            ? 'bg-white text-indigo-600 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]'
                            : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        HISTORY
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 w-full min-h-0 relative">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 backdrop-blur-sm">
                        <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Syncing Data Streams...</span>
                    </div>
                ) : (
                    <div className="h-full w-full">
                        <Line options={options} data={data} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardGraph;
