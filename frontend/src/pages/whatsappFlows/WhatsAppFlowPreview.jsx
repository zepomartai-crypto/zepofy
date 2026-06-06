import React, { useState, useEffect } from 'react';
import { X, Loader2, ArrowRight } from 'lucide-react';
import api from '../../api/api';

export default function WhatsAppFlowPreview({ flowId, onClose }) {
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFlow = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/whatsapp-flows/${flowId}`);
        const flowData = res.data.data;
        if (flowData?.layout?.screens?.length > 0) {
          setScreens(flowData.layout.screens);
        } else {
          // Fallback if empty
          setScreens([
            { id: '1', name: 'Welcome Screen', components: [
              { id: '1', type: 'Heading', label: 'Welcome to our Service', isStatic: true },
              { id: '2', type: 'Input', label: 'Full Name', placeholder: 'Kindly Enter name' }
            ]}
          ]);
        }
      } catch (err) {
        console.error('Failed to load flow for preview:', err);
      } finally {
        setLoading(false);
      }
    };
    if (flowId) {
      fetchFlow();
    }
  }, [flowId]);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-start bg-slate-900/80 backdrop-blur-md overflow-x-auto custom-scrollbar"
      onClick={onClose}
    >
      {/* Close button fixed to viewport */}
      <button 
        onClick={onClose}
        className="fixed top-6 right-6 z-[110] w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors shadow-lg"
      >
        <X size={28} />
      </button>

      {loading ? (
        <div className="w-full flex flex-col items-center justify-center text-white h-full">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
          <p className="font-semibold tracking-wider animate-pulse">Loading Simulator...</p>
        </div>
      ) : (
        <div 
          className="flex gap-16 px-16 py-12 items-center min-h-full min-w-max mx-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {screens.map((screen, idx) => (
            <div key={screen.id} className="flex items-center">
              <div className="flex flex-col items-center relative">
                <h2 className="text-lg font-bold text-white mb-6 drop-shadow-md bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-700">
                  {screen.name || `Screen ${idx + 1}`}
                </h2>

                <div className="relative w-[340px] h-[680px] bg-black rounded-[45px] shadow-2xl p-[6px] shrink-0 border-[3px] border-slate-800">
                  {/* Inner Phone Screen */}
                  <div className="w-full h-full bg-white rounded-[38px] overflow-hidden relative flex flex-col">
                    
                    {/* iPhone Notch Area */}
                    <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50">
                      <div className="w-40 h-6 bg-black rounded-b-[16px]"></div>
                    </div>

                    {/* Status Bar Mock */}
                    <div className="h-10 shrink-0 w-full flex justify-between items-center px-6 text-[10px] font-bold text-slate-800 pt-1 z-40 relative">
                      <span>12:16 PM</span>
                      <div className="flex gap-1.5 items-center">
                        <div className="w-4 h-2.5 bg-slate-800 rounded-sm"></div>
                      </div>
                    </div>

                    {/* Form Content Scrollable */}
                    <div className="flex-1 px-5 pt-2 pb-24 overflow-y-auto custom-scrollbar flex flex-col gap-4 relative">
                      {screen.components && screen.components.length > 0 ? screen.components.map((comp) => (
                        <div key={comp.id} className={`${comp.type === 'Heading' ? 'mb-2' : 'border-b border-slate-200 pb-3'}`}>
                          {comp.type === 'Heading' ? (
                            <h3 className="text-xl font-bold text-slate-800">{comp.label}</h3>
                          ) : comp.type === 'Checkbox' || comp.type === 'Radio' ? (
                            <>
                              <label className="block text-[13px] font-semibold text-slate-800 mb-2">
                                {comp.label}
                              </label>
                              <div className="flex flex-col gap-2">
                                {(comp.options || ['Option 1']).map((opt, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <div className={`w-3.5 h-3.5 border border-slate-300 ${comp.type === 'Radio' ? 'rounded-full' : 'rounded-sm'}`}></div>
                                    <span className="text-[12px] text-slate-600">{opt}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : comp.type === 'ImageUpload' || comp.type === 'FileUpload' ? (
                            <>
                              <label className="block text-[13px] font-semibold text-slate-800 mb-2">
                                {comp.label}
                              </label>
                              <div className="w-full h-20 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400">
                                <span className="text-[10px] font-semibold uppercase">{comp.type}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <label className="block text-[13px] font-semibold text-slate-800 mb-1">
                                {comp.label} {comp.required && <span className="text-red-500">*</span>}
                              </label>
                              <input 
                                type="text" 
                                placeholder={comp.placeholder || 'Select option...'}
                                className="w-full text-[13px] text-slate-800 mt-1 border-none focus:ring-0 p-0 placeholder:text-slate-400 bg-transparent"
                                disabled
                              />
                            </>
                          )}
                        </div>
                      )) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-medium">
                          No components added
                        </div>
                      )}
                    </div>

                    {/* Bottom Submit Button */}
                    <div className="absolute bottom-6 left-5 right-5">
                      <button className="w-full h-11 bg-[#00a884] text-white rounded-full font-bold text-[14px] hover:bg-[#008f6f] transition-colors shadow-lg shadow-[#00a884]/30">
                        {idx === screens.length - 1 ? 'Submit' : 'Next'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Connector Arrow */}
              {idx < screens.length - 1 && (
                <div className="mx-8 text-white/30 flex flex-col items-center justify-center">
                  <ArrowRight size={32} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
