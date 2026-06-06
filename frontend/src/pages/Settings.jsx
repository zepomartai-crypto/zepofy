import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiAlertCircle, FiXCircle } from 'react-icons/fi';
import { useIntegration } from '../context/IntegrationContext';

// Modular Components
import IntegrationsHub from '../components/settings/IntegrationsHub';
import WhatsAppIntegration from '../components/settings/WhatsAppIntegration';
import WebhookIntegration from '../components/settings/WebhookIntegration';
import WooCommerceIntegration from '../components/settings/WooCommerceIntegration';
import ShopifyIntegration from '../components/settings/ShopifyIntegration';
import WhatsAppCommerceIntegration from '../components/settings/WhatsAppCommerceIntegration';
import AIIntegration from '../components/settings/AIIntegration';
import FacebookInstagramIntegration from '../components/settings/FacebookInstagramIntegration';
import { FiArrowLeft, FiGrid } from 'react-icons/fi';

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('service') || 'hub');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { whatsappConnected, wooConnected, shopifyConnected } = useIntegration();

  const handleSelectIntegration = (id) => {
    setActiveTab(id);
    setSearchParams({ service: id });
  };

  const handleBackToHub = () => {
    setActiveTab('hub');
    setSearchParams({});
  };

  // Integration Component Mapper
  const renderIntegration = () => {
    const commonProps = {
      successMessage,
      errorMessage,
      setSuccessMessage,
      setErrorMessage
    };

    switch (activeTab) {
      case 'hub':
        return <IntegrationsHub onSelect={handleSelectIntegration} />;
      case 'whatsapp':
        return <WhatsAppIntegration {...commonProps} />;
      case 'woocommerce':
        return <WooCommerceIntegration {...commonProps} />;
      case 'shopify':
        return <ShopifyIntegration {...commonProps} />;
      case 'whatsapp_commerce':
        return <WhatsAppCommerceIntegration {...commonProps} />;
      case 'facebook_instagram':
        return <FacebookInstagramIntegration {...commonProps} />;
      case 'ai_bot':
        return <AIIntegration {...commonProps} />;
      default:
        return <IntegrationsHub onSelect={handleSelectIntegration} />;
    }
  };

  return (
    <div className="h-full bg-slate-50 font-poppins selection:bg-blue-100">
      {/* Notifications */}
      <div className="fixed top-8 right-8 z-50 flex flex-col gap-4 max-w-[420px] w-full">
        {successMessage && (
          <div className="bg-white/90 backdrop-blur-xl border border-blue-100 text-slate-900 px-6 py-4.5 rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] flex items-center gap-4 animate-in fade-in slide-in-from-right-10 duration-500">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
              <FiCheckCircle className="text-white w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-slate-900 tracking-tight">Protocol Success</h4>
              <p className="font-medium text-[12px] text-slate-500 tracking-tight leading-tight mt-0.5">{successMessage}</p>
            </div>
          </div>
        )}
        {errorMessage && (
          <div className="bg-white/90 backdrop-blur-xl border border-red-100 text-slate-900 px-6 py-4.5 rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] flex items-center gap-4 animate-in fade-in slide-in-from-right-10 duration-500">
            <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-200 shrink-0">
              <FiXCircle className="text-white w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-slate-900 tracking-tight">Action Required</h4>
              <p className="font-medium text-[12px] text-slate-500 tracking-tight leading-tight mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col min-h-screen w-full">
        {/* Navigation Header (Conditional) */}
        {activeTab !== 'hub' && (
          <header className="bg-white border-b border-slate-200/60 sticky top-0 z-30 px-4 lg:px-8 xl:px-12 py-4">
            <div className="w-full flex items-center justify-between font-poppins">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBackToHub}
                  className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-100 transition-all active:scale-95 group"
                >
                  <FiArrowLeft className="group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Configuration</h2>
                  <p className="text-[11px] text-slate-400 font-medium tracking-tight">Return to Integrations Hub</p>
                </div>
              </div>

              <button
                onClick={handleBackToHub}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[12px] font-bold border border-slate-100 hover:bg-white hover:shadow-md transition-all active:scale-95"
              >
                <FiGrid className="text-slate-400" />
                Browse All
              </button>
            </div>
          </header>
        )}

        {/* Content Panel */}
        <div className="flex-1 overflow-auto relative">
          <div className="w-full px-4 py-8 lg:px-8 xl:px-12">
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
              {renderIntegration()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}