import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { FiX, FiAlertCircle, FiCheckCircle, FiInfo, FiTrash2 } from 'react-icons/fi';

const NiceModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  type = 'info', 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  showInput = false,
  defaultValue = '',
  placeholder = 'Enter value...'
}) => {
  const [inputValue, setInputValue] = useState(defaultValue);

  // Handle Enter and ESC keys
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm(showInput ? inputValue : true);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onClose, showInput, inputValue]);

  if (!isOpen) return null;

  const icons = {
    info: <FiInfo className="text-blue-500 w-8 h-8" />,
    success: <FiCheckCircle className="text-emerald-500 w-8 h-8" />,
    warning: <FiAlertCircle className="text-amber-500 w-8 h-8" />,
    danger: <FiTrash2 className="text-rose-500 w-8 h-8" />,
  };

  const colors = {
    info: 'blue',
    success: 'emerald',
    warning: 'amber',
    danger: 'rose',
  };

  const currentColor = colors[type] || 'blue';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 font-['Poppins']">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className="relative bg-white rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
        <div className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`p-4 bg-${currentColor}-50 rounded-2xl`}>
              {icons[type]}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-slate-800 tracking-tight">{title}</h3>
              <p className="text-sm font-normal text-slate-500 leading-relaxed px-4">{message}</p>
            </div>

            {showInput && (
              <div className="w-full pt-2">
                <input
                  autoFocus
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-slate-700 placeholder:text-slate-300"
                />
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-10">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3.5 rounded-2xl text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-all border border-slate-100 tracking-wide"
            >
              {cancelText}
            </button>
            <button
              onClick={() => onConfirm(showInput ? inputValue : true)}
              className={`flex-1 px-6 py-3.5 bg-${currentColor === 'rose' ? 'rose-500' : (currentColor === 'emerald' ? 'emerald-500' : (currentColor === 'amber' ? 'amber-500' : 'blue-600'))} text-white rounded-2xl text-sm font-semibold shadow-lg shadow-${currentColor}-200 transition-all hover:scale-[1.02] active:scale-95 tracking-wide`}
            >
              {confirmText}
            </button>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-600 transition-colors"
        >
          <FiX size={20} />
        </button>
      </div>
    </div>
  );
};

// Singleton controller for the modal
let modalRoot = null;

const nicePrompt = {
  /**
   * Show a beautiful confirmation/alert modal
   */
  show: (options) => {
    return new Promise((resolve) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      if (!modalRoot) {
        modalRoot = createRoot(container);
      } else {
        // If reusing root, we need to handle it differently but for now let's keep it simple
        const newContainer = document.createElement('div');
        document.body.appendChild(newContainer);
        modalRoot = createRoot(newContainer);
      }

      const close = (result = null) => {
        modalRoot.render(<NiceModal isOpen={false} />);
        setTimeout(() => {
          document.body.removeChild(container);
          resolve(result);
        }, 300);
      };

      modalRoot.render(
        <NiceModal 
          isOpen={true} 
          {...options} 
          onClose={() => close(null)}
          onConfirm={(val) => close(val)}
        />
      );
    });
  },

  confirm: (title, message, type = 'warning') => {
    return nicePrompt.show({ title, message, type, confirmText: 'Yes, Proceed', cancelText: 'No, Cancel' });
  },

  ask: (title, message, placeholder = 'Type here...', defaultValue = '') => {
    return nicePrompt.show({ 
      title, 
      message, 
      showInput: true, 
      placeholder, 
      defaultValue, 
      confirmText: 'Save', 
      cancelText: 'Cancel' 
    });
  },

  success: (title, message) => {
    return nicePrompt.show({ title, message, type: 'success', confirmText: 'Perfect', cancelText: 'Close' });
  },

  error: (title, message) => {
    return nicePrompt.show({ title, message, type: 'danger', confirmText: 'I Understand', cancelText: 'Close' });
  }
};

export default nicePrompt;
