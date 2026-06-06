import React, { useState, useEffect } from 'react';
import {
    RefreshCw,
    ShoppingCart,
    ShoppingBag,
    MessageSquare,
    ExternalLink,
    Search,
    CheckCircle2,
    Clock,
    User,
    Shield,
    Layers,
    Bot,
    Smartphone
} from 'lucide-react';
import api from '../../api/api';

const GlobalIntegrations = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchIntegrations = async () => {
        try {
            setLoading(true);
            const res = await api.get('/superadmin/integrations');
            console.log('🔍 [FRONTEND] Global Integrations API response:', res.data);

            // CORRECT: Extract data from response.data.data
            if (res.data.success && res.data.data) {
                const apiData = res.data.data;
                console.log('✅ [FRONTEND] Integrations data extracted:', {
                    summary: apiData.summary,
                    usersCount: apiData.users?.length || 0,
                    integrationCount: apiData.integrationCount
                });

                setData(apiData);
            } else {
                console.error('❌ [FRONTEND] Invalid API response structure:', res.data);
                setData(null);
            }
        } catch (err) {
            console.error('❌ [FRONTEND] Failed to fetch integrations', err);
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIntegrations();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-32">
                <RefreshCw className="animate-spin text-indigo-600 mb-4" size={40} />
                <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Mapping global gateway matrix...</span>
            </div>
        );
    }

    // Use the users array from the backend response
    const allIntegrations = data?.users?.filter(user =>
        user.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    // Debug logging
    console.log('🔍 [DEBUG] Global Integrations:', {
        hasData: !!data,
        usersCount: data?.users?.length || 0,
        allIntegrationsCount: allIntegrations.length,
        searchTerm
    });

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-[22px] font-bold text-slate-900 leading-snug">Global Integrations</h1>
                    <p className="text-sm font-normal text-slate-500 mt-1">Manage external connections and gateway statuses</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Find by user..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-900 pl-11 pr-4 py-2.5 rounded-lg w-full md:w-80 outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-medium text-sm shadow-[0px_4px_12px_rgba(0,0,0,0.05)]"
                        />
                    </div>
                    <button onClick={fetchIntegrations} className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-600 transition-all shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] flex items-center justify-between group overflow-hidden relative">
                    <div className="relative z-10">
                        <h3 className="text-slate-500 font-medium text-sm mb-1">WooCommerce Connected</h3>
                        <div className="text-3xl font-bold text-slate-900">{data?.summary?.totalWooCommerce || 0}</div>
                        <div className="flex items-center gap-2 mt-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full w-fit">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div> Active Stores
                        </div>
                    </div>
                    <div className="p-4 bg-orange-50 text-orange-600 rounded-[12px] group-hover:scale-110 transition-transform duration-500">
                        <ShoppingCart size={24} />
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] flex items-center justify-between group overflow-hidden relative">
                    <div className="relative z-10">
                        <h3 className="text-slate-500 font-medium text-sm mb-1">Shopify Connected</h3>
                        <div className="text-3xl font-bold text-slate-900">{data?.summary?.totalShopify || 0}</div>
                        <div className="flex items-center gap-2 mt-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full w-fit">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div> Active Stores
                        </div>
                    </div>
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-[12px] group-hover:scale-110 transition-transform duration-500">
                        <ShoppingBag size={24} />
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] flex items-center justify-between group overflow-hidden relative">
                    <div className="relative z-10">
                        <h3 className="text-slate-500 font-medium text-sm mb-1">WhatsApp Connected</h3>
                        <div className="text-3xl font-bold text-slate-900">{data?.summary?.totalWhatsApp || 0}</div>
                        <div className="flex items-center gap-2 mt-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full w-fit">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div> Active Numbers
                        </div>
                    </div>
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-[12px] group-hover:scale-110 transition-transform duration-500">
                        <MessageSquare size={24} />
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] flex items-center justify-between group overflow-hidden relative">
                    <div className="relative z-10">
                        <h3 className="text-slate-500 font-medium text-sm mb-1">AI Connected</h3>
                        <div className="text-3xl font-bold text-slate-900">{data?.summary?.totalAiBot || 0}</div>
                        <div className="flex items-center gap-2 mt-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full w-fit">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div> Active Bots
                        </div>
                    </div>
                    <div className="p-4 bg-purple-50 text-purple-600 rounded-[12px] group-hover:scale-110 transition-transform duration-500">
                        <Bot size={24} />
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] flex items-center justify-between group overflow-hidden relative">
                    <div className="relative z-10">
                        <h3 className="text-slate-500 font-medium text-sm mb-1">Insta/FB Connected</h3>
                        <div className="text-3xl font-bold text-slate-900">{data?.summary?.totalFacebookInstagram || 0}</div>
                        <div className="flex items-center gap-2 mt-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full w-fit">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div> Active Accounts
                        </div>
                    </div>
                    <div className="p-4 bg-pink-50 text-pink-600 rounded-[12px] group-hover:scale-110 transition-transform duration-500">
                        <Smartphone size={24} />
                    </div>
                </div>
            </div>

            {/* Integration Table */}
            <div className="bg-white border border-slate-200 rounded-[12px] overflow-hidden shadow-[0px_4px_12px_rgba(0,0,0,0.05)] overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">User Details</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">WooCommerce</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Shopify</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">WhatsApp</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">AI Integration</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">FB & Insta</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Last Connected</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {allIntegrations.map((user) => (
                            <tr key={user.userId} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 text-sm border border-indigo-100">
                                            {user.userName?.[0]?.toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-800 text-[14px] leading-tight">{user.userName}</div>
                                            <div className="font-semibold text-slate-400 text-[11px]">{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {user.woocommerce?.connected ? (
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full w-fit">
                                                <CheckCircle2 size={12} className="text-blue-600" />
                                                Connected
                                            </div>
                                            {user.woocommerce.storeUrl && (
                                                <a href={`https://${user.woocommerce.storeUrl}`} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-indigo-600 truncate max-w-[150px] block">
                                                    {user.woocommerce.storeUrl}
                                                </a>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full w-fit">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                            Not Connected
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {user.shopify?.connected ? (
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full w-fit">
                                                <CheckCircle2 size={12} className="text-blue-600" />
                                                Connected
                                            </div>
                                            {user.shopify.storeUrl && (
                                                <a href={`https://${user.shopify.storeUrl}`} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-indigo-600 truncate max-w-[150px] block">
                                                    {user.shopify.storeUrl}
                                                </a>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full w-fit">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                            Not Connected
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {user.whatsapp?.connected ? (
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full w-fit">
                                                <CheckCircle2 size={12} className="text-blue-600" />
                                                Connected
                                            </div>
                                            {user.whatsapp.phone && (
                                                <div className="text-xs text-slate-500">
                                                    {user.whatsapp.phone}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full w-fit">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                            Not Connected
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {user.ai_bot?.connected ? (
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-full w-fit">
                                            <CheckCircle2 size={12} className="text-purple-600" />
                                            Connected
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full w-fit">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                            Not Connected
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {user.facebook_instagram?.connected ? (
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-pink-700 bg-pink-50 border border-pink-100 px-2.5 py-1 rounded-full w-fit">
                                            <CheckCircle2 size={12} className="text-pink-600" />
                                            Connected
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full w-fit">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                            Not Connected
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="font-semibold text-slate-800 text-[14px]">
                                        {user.woocommerce?.connectedAt ? new Date(user.woocommerce.connectedAt).toLocaleDateString('en-GB') : '-'}
                                    </div>
                                    <div className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider">
                                        {(user.woocommerce?.connectedAt || user.whatsapp?.connectedAt) ? 'Latest Activity' : 'No Activity'}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {allIntegrations.length === 0 && (
                    <div className="p-12 text-center">
                        <Shield className="mx-auto text-slate-200 mb-4" size={48} />
                        <h3 className="text-slate-900 font-medium text-sm">No integrations found</h3>
                        <p className="text-slate-500 text-xs mt-1">Try adjusting your search terms</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GlobalIntegrations;
