import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiShoppingCart } from 'react-icons/fi';
import { useIntegration } from '../context/IntegrationContext';

const WooCommerceCTABanner = () => {
    const navigate = useNavigate();
    const { wooConnected, loading } = useIntegration();

    // 1. If loading or already connected, do not show
    if (loading || wooConnected) return null;

    return (
        <div className="p-6 bg-gradient-to-r from-orange-500 to-orange-600 rounded-[12px] shadow-lg shadow-orange-200 flex flex-col md:flex-row items-center justify-between text-white animate-in slide-in-from-top duration-500 gap-4 mb-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-[12px]">
                    <FiShoppingCart size={24} />
                </div>
                <div>
                    <h4 className="font-bold text-lg">Automate your store with WooCommerce</h4>
                    <p className="text-sm text-orange-50/90 font-medium">Connect your store to unlock abandoned cart recovery and order notifications.</p>
                </div>
            </div>
            <button
                onClick={() => navigate('/settings?tab=woocommerce')}
                className="w-full md:w-auto px-6 py-2.5 bg-white text-orange-600 font-bold rounded-[12px] hover:bg-orange-50 transition-all shadow-[0px_4px_12px_rgba(0,0,0,0.05)] flex items-center justify-center gap-2 whitespace-nowrap outline-none"
            >
                Connect Store <FiShoppingCart className="w-4 h-4" />
            </button>
        </div>
    );
};

export default WooCommerceCTABanner;
