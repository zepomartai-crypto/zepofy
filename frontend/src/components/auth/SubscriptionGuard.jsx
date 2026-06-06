import React from 'react';
import { useAuth } from '../../context/useAuth';
import { Crown, Lock, ArrowRight, CreditCard, ShieldCheck } from 'lucide-react';

const SubscriptionGuard = ({ children }) => {
  const { user } = useAuth();

  const isExpired = user?.role === 'user' && user?.accountExpiry && new Date() > new Date(user.accountExpiry);

  if (isExpired) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center p-6 overflow-hidden">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-[120px] opacity-60 animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-purple-50 rounded-full blur-[120px] opacity-60 animate-pulse" />
        </div>

        <div className="max-w-xl w-full text-center space-y-12 animate-in fade-in zoom-in-95 duration-700">
          {/* Visual Icon */}
          <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
            <div className="absolute inset-0 bg-indigo-600/5 rounded-full scale-150 animate-ping duration-3000" />
            <div className="absolute inset-0 bg-indigo-600/10 rounded-full scale-125" />
            <div className="relative w-full h-full bg-white rounded-full shadow-2xl shadow-indigo-200 border border-indigo-50 flex items-center justify-center">
              <Lock className="w-12 h-12 text-indigo-600" strokeWidth={2.5} />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2 rounded-xl shadow-lg">
              <Crown size={20} fill="currentColor" />
            </div>
          </div>

          {/* Text Content */}
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Subscription Expired</h1>
            <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-md mx-auto">
              Your access to <span className="text-indigo-600 font-bold">Zepofy Premium</span> has ended. Please renew your subscription to unlock all features and continue growing your business.
            </p>
          </div>

          {/* Details Card */}
          <div className="bg-slate-50 border border-slate-100 rounded-[32px] p-8 grid grid-cols-2 gap-4">
            <div className="text-left space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Plan</p>
              <p className="font-bold text-slate-700">{user?.plan || 'Free Tier'}</p>
            </div>
            <div className="text-left space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
              <p className="font-bold text-red-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Expired
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <button 
              onClick={() => window.open('https://zepofy.com/pricing', '_blank')}
              className="flex-1 w-full flex items-center justify-center gap-3 bg-indigo-600 text-white px-8 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-indigo-200 group"
            >
              <CreditCard size={18} />
              Renew Subscription
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => window.location.href = '/login'}
              className="flex-1 w-full bg-white border-2 border-slate-100 text-slate-500 px-8 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 hover:text-slate-700 transition-all"
            >
              Logout Account
            </button>
          </div>

          {/* Footer Security Note */}
          <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-bold">
            <ShieldCheck size={14} />
            <span>Secure Enterprise Billing & Encryption</span>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default SubscriptionGuard;
