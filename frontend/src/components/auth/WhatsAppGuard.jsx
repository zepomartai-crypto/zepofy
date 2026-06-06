import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { useIntegration } from '../../context/IntegrationContext';
import { FiZap, FiSettings, FiArrowRight, FiShield } from 'react-icons/fi';

const WhatsAppGuard = ({ children, title = "WhatsApp Integration Required", description = "To access this feature, you must first connect your WhatsApp Business Account. This allows you to send messages, manage templates, and build automation flows." }) => {
  const { user, loading: authLoading } = useAuth();
  const { whatsappConnected, loading: integrationLoading } = useIntegration();
  const navigate = useNavigate();

  // If either is loading, show spinner
  if (authLoading || integrationLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If connected (either via user object or integration context), show children
  if (user?.isWhatsAppConnected || whatsappConnected) {
    return children;
  }

  // If not connected, show the "WOW" empty state
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-8 animate-in fade-in zoom-in duration-700 font-['Poppins']">
      <div className="relative w-full max-w-2xl text-center space-y-10 group">
        
        {/* Background Decorative Blobs */}
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-100/50 rounded-full blur-3xl group-hover:bg-blue-200/50 transition-all duration-1000" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-emerald-100/50 rounded-full blur-3xl group-hover:bg-emerald-200/50 transition-all duration-1000" />

        {/* Premium Illustration placeholder (Uses font-awesome icons or similar if image fails) */}
        <div className="relative mx-auto w-64 h-64 drop-shadow-[0_20px_50px_rgba(59,130,246,0.15)] hover:scale-105 transition-transform duration-500 flex items-center justify-center">
            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[40px] flex items-center justify-center text-white shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.2),transparent)] opacity-40 animate-pulse"></div>
                <div className="relative z-10 p-8 flex flex-col items-center gap-4">
                     <div className="relative">
                        <div className="w-24 h-24 bg-white/20 rounded-full animate-ping absolute -inset-0"></div>
                        <div className="relative w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-blue-600 rotate-6 shadow-xl">
                            <FiZap size={48} className="animate-pulse" />
                        </div>
                     </div>
                </div>
            </div>
           
           {/* Floating Badge */}
           <div className="absolute -top-6 -right-6 bg-white/90 backdrop-blur-md border border-white p-5 rounded-3xl shadow-xl animate-bounce">
              <FiShield className="text-emerald-500 text-4xl" />
           </div>
        </div>

        {/* Content */}
        <div className="space-y-4 relative z-10">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Connect Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">WhatsApp</span>
          </h2>
          <p className="text-slate-500 text-lg font-medium max-w-lg mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        {/* Action Button */}
        <div className="flex flex-col items-center gap-6 pt-4">
          <button
            onClick={() => navigate('/settings?tab=whatsapp')}
            className="group relative flex items-center gap-4 bg-slate-900 text-white px-10 py-5 rounded-[24px] font-bold text-lg hover:bg-black transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-slate-200"
          >
            <FiSettings className="group-hover:rotate-90 transition-transform duration-500" />
            Setup Integration
            <FiArrowRight className="group-hover:translate-x-2 transition-transform duration-300" />
          </button>
          
          <div className="flex items-center gap-6 text-[13px] font-bold text-slate-400">
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Meta Verified API
             </div>
             <div className="w-1 h-1 rounded-full bg-slate-200" />
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Cloud Messaging
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppGuard;
