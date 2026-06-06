import React from "react";
import {
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Mic,
  Send,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Zap
} from "lucide-react";
import { motion } from "framer-motion";

export default function WhatsAppSimulator({ state = "template", data = {} }) {
  const getHeader = () => (
    <div className="bg-[#008069] text-white p-4 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
        <ChevronLeft size={20} />
        <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white/20 overflow-hidden flex items-center justify-center text-slate-500 font-bold">
          Z
        </div>
        <div>
          <p className="text-sm font-bold">Zepofy Store</p>
          <p className="text-[10px] opacity-80 font-medium">online</p>
        </div>
      </div>
      <div className="flex items-center gap-4 opacity-90">
        <Video size={18} />
        <Phone size={18} />
        <MoreVertical size={18} />
      </div>
    </div>
  );

  const getTemplateView = () => (
    <div className="flex flex-col gap-4 p-4">
      <div className="self-start max-w-[85%] bg-white rounded-2xl rounded-tl-none shadow-sm overflow-hidden border border-slate-100">
        {data.imageUrl && (
          <img src={data.imageUrl} alt="Template Header" className="w-full aspect-video object-cover" />
        )}
        <div className="p-3 space-y-2">
          {data.header && <p className="font-bold text-sm text-slate-900">{data.header}</p>}
          <p className="text-[13px] text-slate-700 leading-relaxed">
            {data.body || "Hello! 👋 Welcome to our store. Click below to view our latest catalog and start shopping."}
          </p>
          {data.footer && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{data.footer}</p>}

          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[9px] text-slate-400">10:00 AM</span>
            <CheckCheck size={10} className="text-blue-500" />
          </div>
        </div>

        <div className="border-t border-slate-50 p-2 space-y-1 bg-slate-50/30">
          <div className="w-full py-2.5 px-4 bg-white border border-slate-200 text-blue-600 rounded-xl text-xs font-bold text-center shadow-sm">
            <div className="flex items-center justify-center gap-2">
              <ShoppingBag size={14} /> {data.buttonLabel || "View Catalog"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const getCatalogView = () => (
    <div className="flex-1 flex flex-col bg-white">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <p className="font-bold text-slate-900">Products List</p>
        <span className="text-xs font-bold text-slate-400 px-2 py-0.5 bg-white border border-slate-200 rounded-full">3 items</span>
      </div>
      <div className="p-4 space-y-4 overflow-y-auto">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 group">
            <div className="w-16 h-16 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-300">
              <ShoppingBag size={24} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-slate-900 leading-tight">Premium Item {i}</p>
              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">High quality material with premium finish.</p>
              <div className="flex items-center justify-between mt-2">
                <p className="font-black text-emerald-600">₹1,299</p>
                <button className="px-3 py-1 bg-white border border-emerald-500 text-emerald-600 rounded-lg text-[10px] font-bold group-hover:bg-emerald-600 group-hover:text-white transition-all">Add to Cart</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 mt-auto">
        <button className="w-full py-4 bg-[#008069] text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-100 uppercase tracking-widest flex items-center justify-center gap-3">
          Send to Merchant <Send size={20} />
        </button>
      </div>
    </div>
  );

  const getReplyView = () => (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div className="self-start max-w-[85%] bg-white rounded-2xl rounded-tl-none shadow-sm p-3 border border-slate-100">
        <p className="text-[13px] text-slate-700">Please select the items you are interested in.</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[9px] text-slate-400">10:02 AM</span>
          <CheckCheck size={10} className="text-blue-500" />
        </div>
      </div>

      <div className="self-end max-w-[85%] bg-[#D9FDD3] rounded-2xl rounded-tr-none shadow-sm p-3 relative">
        <div className="p-2 bg-white/50 rounded-xl mb-2 flex items-center gap-3 border border-emerald-100">
          <ShoppingBag size={18} className="text-emerald-600" />
          <p className="text-xs font-bold text-emerald-800">1 Item Selected</p>
        </div>
        <p className="text-[13px] text-slate-700">I'm interested in Premium Item 1. Can you share more details?</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[9px] text-slate-400 opacity-60">10:05 AM</span>
          <CheckCheck size={10} className="text-blue-500 opacity-60" />
        </div>
      </div>

      <div className="self-start max-w-[85%] bg-white rounded-2xl rounded-tl-none shadow-sm p-3 border border-emerald-100 flex items-center gap-3">
        <Zap className="text-emerald-500" size={18} />
        <p className="text-[13px] text-slate-800 font-medium italic animate-pulse">Assistant is typing...</p>
      </div>
    </div>
  );

  return (
    <div className="w-[380px] h-[640px] bg-[#EFEAE2] rounded-[48px] border-[8px] border-slate-900 overflow-hidden shadow-2xl relative flex flex-col font-sans">
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-slate-900 rounded-b-2xl z-50 flex items-center justify-center">
        <div className="w-12 h-1 bg-slate-800 rounded-full" />
      </div>

      {getHeader()}

      <div className="flex-1 overflow-hidden flex flex-col relative bg-[url('https://w0.peakpx.com/wallpaper/580/630/HD-wallpaper-whatsapp-background-whatsapp-patterns.jpg')] bg-repeat bg-[length:400px]">
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />

        <div className="relative z-10 flex flex-col h-full overflow-y-auto">
          {state === "template" && getTemplateView()}
          {state === "catalog" && getCatalogView()}
          {(state === "reply" || state === "bot") && getReplyView()}
        </div>
      </div>

      {/* Input Bar */}
      <div className="p-3 bg-white flex items-center gap-3">
        <div className="flex-1 bg-slate-50 rounded-full flex items-center px-4 py-2 gap-3 border border-slate-100">
          <Smile size={20} className="text-slate-400" />
          <input type="text" placeholder="Message" className="flex-1 bg-transparent border-none text-sm focus:ring-0 placeholder:text-slate-300" disabled />
          <Paperclip size={18} className="text-slate-400 -rotate-45" />
        </div>
        <div className="w-11 h-11 bg-[#008069] rounded-full flex items-center justify-center text-white shadow-md">
          <Mic size={20} />
        </div>
      </div>

      {/* Mock Indicator */}
      <div className="absolute top-10 right-10 flex gap-2">
        {["template", "catalog", "reply"].map(s => (
          <div key={s} className={`w-1.5 h-1.5 rounded-full ${state === s ? 'bg-white' : 'bg-white/30'}`} />
        ))}
      </div>
    </div>
  );
}
