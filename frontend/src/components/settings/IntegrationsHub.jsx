import React, { useState, useEffect } from 'react';
import {
  FiSearch, FiGlobe, FiSettings, FiShoppingCart, FiShoppingBag,
  FiMail, FiMessageCircle, FiDatabase, FiCpu, FiSend,
  FiInstagram, FiFacebook, FiTrendingUp
} from 'react-icons/fi';
import { useIntegration } from '../../context/IntegrationContext';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';

const INTEGRATIONS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Connect your Meta WhatsApp Business API to enable large-scale communication.',
    icon: <FiMessageCircle size={24} />,
    color: 'bg-gradient-to-br from-[#2056FF] via-[#1539C2] to-[#0A1E85]',
    type: 'Communication',
    category: 'official'
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    description: 'Sync your WordPress store logic and automate order confirmations.',
    icon: <FiShoppingCart size={24} />,
    color: 'bg-gradient-to-br from-[#7F54B3] via-[#6B429A] to-[#4D2E7A]',
    type: 'E-commerce',
    category: 'ecommerce'
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Connect your Shopify store using App Bridge to recover abandoned carts.',
    icon: <FiShoppingBag size={24} />,
    color: 'bg-gradient-to-br from-[#96BF48] to-[#6B8E23]',
    type: 'E-commerce',
    category: 'ecommerce'
  },
  {
    id: 'whatsapp_commerce',
    name: 'WhatsApp Commerce',
    description: 'Connect your Meta Commerce Catalog to showcase products and receive orders.',
    icon: <FiShoppingBag size={24} />,
    color: 'bg-gradient-to-br from-[#10B981] to-[#059669]',
    type: 'E-commerce',
    category: 'ecommerce'
  },
  {
    id: 'website',
    name: 'Website Integration',
    description: 'Capture inquiries directly from your website forms via webhooks.',
    icon: <FiGlobe size={24} />,
    color: 'bg-gradient-to-br from-[#6366F1] to-[#4338CA]',
    type: 'Lead Capture',
    isComingSoon: true
  },
  {
    id: 'facebook_instagram',
    name: 'Facebook & Instagram',
    description: 'Connect Facebook Pages and Instagram Business accounts to track messages, comments, and lead events.',
    icon: <FiInstagram size={24} />,
    color: 'bg-gradient-to-br from-[#E1306C] via-[#C13584] to-[#833AB4]',
    type: 'Social Suite'
  },
  {
    id: 'ai_bot',
    name: 'AI Integration',
    description: 'Connect OpenAI or Gemini to enable smart AI auto-replies.',
    icon: <FiCpu size={24} />,
    color: 'bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9]',
    type: 'Automation'
  }
];

const IntegrationsHub = ({ onSelect }) => {
  const { user } = useAuth();
  const { whatsappConnected, catalogConnected, wooConnected, shopifyConnected, aiConnected, facebookInstagramConnected } = useIntegration();
  const [searchTerm, setSearchTerm] = useState('');

  const getStatus = (id) => {
    switch (id) {
      case 'whatsapp': return whatsappConnected;
      case 'whatsapp_commerce': return catalogConnected;
      case 'woocommerce': return wooConnected;
      case 'shopify': return shopifyConnected;
      case 'facebook_instagram': return facebookInstagramConnected;
      case 'ai_bot': return aiConnected;
      default: return false;
    }
  };

  const filteredIntegrations = INTEGRATIONS
    .filter(item => {
      // 🔐 PERMISSION CHECK: Hide integrations disabled by Super Admin
      const config = user?.integrations?.[item.id];

      // Facebook & Instagram MUST be explicitly enabled by Superadmin
      if (item.id === 'facebook_instagram' && (!config || config.enabled !== true)) return false;

      // Other integrations are hidden if explicitly disabled
      if (item.id !== 'facebook_instagram' && config && config.enabled === false) return false;

      // Special check for AI Tools permission (Legacy or Hub ID mapping)
      if (item.id === 'ai_bot' && user?.integrations?.ai_bot?.enabled === false) return false;

      return item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => (a.isComingSoon === b.isComingSoon) ? 0 : a.isComingSoon ? 1 : -1);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-poppins">
      {/* Search & Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200/60">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Integrations Hub</h1>
          <p className="text-[13px] text-slate-500 font-medium">Connect your favorite platforms to supercharge your workflow.</p>
        </div>

        <div className="relative group max-w-md w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-blue-600 text-slate-400 transition-colors">
            <FiSearch size={18} />
          </div>
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm font-medium shadow-sm hover:border-slate-300"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredIntegrations.map((item) => {
          const isActive = getStatus(item.id);

          return (
            <div
              key={item.id}
              className="bg-white rounded-[28px] p-7 border border-slate-100/80 relative overflow-hidden group transition-all duration-500 flex flex-col h-full"
            >
              {/* Coming Soon Overlay */}
              {item.isComingSoon && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-widest rounded-lg border border-slate-200">
                    Coming Soon
                  </span>
                </div>
              )}

              {/* Status Badge */}
              {!item.isComingSoon && isActive && (
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase tracking-widest rounded-lg border border-emerald-100 animate-in fade-in zoom-in duration-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  Active
                </div>
              )}

              {/* Icon */}
              <div className={`w-14 h-14 ${item.color} rounded-2xl flex items-center justify-center text-white mb-6 transition-transform duration-500 group-hover:scale-110`}>
                {item.icon}
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <h3 className="font-bold text-slate-900 text-[16px] tracking-tight">{item.name}</h3>
                <p className="text-[12px] text-slate-500 leading-relaxed font-medium line-clamp-3">
                  {item.description}
                </p>
              </div>

              {/* Action */}
              <div className="mt-8">
                <button
                  onClick={() => !item.isComingSoon && onSelect(item.id)}
                  disabled={item.isComingSoon}
                  className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-3 font-semibold text-[13px] transition-all duration-300 active:scale-95 ${item.isComingSoon
                    ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                    : 'bg-slate-50 text-slate-900 border border-slate-200/50 hover:bg-blue-600 hover:text-white hover:border-transparent'
                    }`}
                >
                  <FiSettings size={14} className={item.isComingSoon ? '' : 'transition-transform duration-700 group-hover:rotate-180'} />
                  <span className="relative z-10">Configure Service</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredIntegrations.length === 0 && (
        <div className="py-20 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
            <FiSearch size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-lg">No integrations found</h3>
            <p className="text-slate-500 text-sm font-medium">Try matching the service name or description.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationsHub;
