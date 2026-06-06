import React from 'react';
import { FiMessageSquare, FiSettings, FiShoppingCart, FiServer, FiChevronRight, FiZap, FiGlobe } from 'react-icons/fi';

const SettingsSidebar = ({ activeTab, setActiveTab }) => {
    const sections = [
        {
            title: 'Communication',
            items: [
                {
                    id: 'whatsapp',
                    label: 'WhatsApp',
                    icon: FiMessageSquare,
                    description: 'Meta Business API'
                }
            ]
        },
        {
            title: 'E-Commerce Stores',
            items: [
                {
                    id: 'woocommerce',
                    label: 'WooCommerce',
                    icon: FiShoppingCart,
                    description: 'WP Store Sync'
                },
                {
                    id: 'shopify',
                    label: 'Shopify',
                    icon: FiServer,
                    description: 'Store automation'
                }
            ]
        }
    ];

    return (
        <div className="h-full flex flex-col font-poppins bg-white">
            {/* Header */}
            <div className="px-6 py-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <FiSettings size={16} strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="text-[13px] font-semibold text-slate-800 tracking-tight font-poppins">Integrations</h3>
                        <p className="text-[10px] text-slate-400 font-medium font-poppins">Manage connections</p>
                    </div>
                </div>
            </div>

            {/* Navigation Sections */}
            <div className="flex-1 overflow-y-auto py-6 scrollbar-hide">
                {sections.map((section, idx) => (
                    <div key={idx} className={`${idx !== 0 ? 'mt-8' : ''}`}>
                        <div className="px-8 mb-4">
                            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.15em]">{section.title}</h4>
                        </div>
                        <nav className="px-3 space-y-1">
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                const isActive = activeTab === item.id;

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTab(item.id)}
                                        className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${isActive
                                            ? 'bg-blue-50/50 text-blue-600 shadow-sm border border-blue-100/50'
                                            : 'text-slate-500 hover:bg-slate-50 border border-transparent'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg transition-all duration-300 ${isActive
                                            ? 'bg-blue-600 text-white shadow-lg'
                                            : 'bg-slate-100 text-slate-500 group-hover:bg-white'
                                            }`}>
                                            <Icon size={16} strokeWidth={2} />
                                        </div>
                                        <div className="flex-1 text-left min-w-0 font-poppins">
                                            <div className={`font-semibold text-[13px] truncate tracking-tight transition-colors ${isActive ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900'
                                                }`}>
                                                {item.label}
                                            </div>
                                            <div className={`text-[10px] font-medium truncate transition-colors ${isActive ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-500'
                                                }`}>
                                                {item.description}
                                            </div>
                                        </div>
                                        <FiChevronRight className={`w-3.5 h-3.5 transition-all duration-300 ${isActive
                                            ? 'text-blue-500 translate-x-0 opacity-100'
                                            : 'text-slate-300 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                                            }`} />
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                ))}
            </div>

            {/* Status Card */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/30">
                <div className="p-5 bg-white border border-slate-200/60 rounded-[24px] shadow-sm relative overflow-hidden group">
                    <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-125 transition-all duration-700">
                        <FiZap size={80} className="text-blue-600" />
                    </div>
                    <div className="flex items-center gap-2 mb-4 relative z-10">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <h4 className="text-slate-400 font-semibold text-[10px] uppercase tracking-widest">System Health</h4>
                    </div>
                    <div className="space-y-3 relative z-10">
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-semibold text-slate-500 tracking-tight">Active Nodes</span>
                            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">8/8</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full w-full bg-blue-600 rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsSidebar;
