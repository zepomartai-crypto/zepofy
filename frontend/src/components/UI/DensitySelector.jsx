import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export default function DensitySelector({
  value,
  onChange,
  options = [
    { label: "5 Rows", value: 5 },
    { label: "10 Rows", value: 10 },
    { label: "20 Rows", value: 20 },
    { label: "50 Rows", value: 50 },
  ],
  label = "Density:",
  labelClassName = "text-[10px] font-bold text-slate-400 uppercase tracking-widest",
  fullWidth = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className={`flex items-center gap-2 ${fullWidth ? 'w-full flex-col items-stretch gap-1.5' : ''}`} ref={dropdownRef}>
      {label && <span className={labelClassName}>{label}</span>}
      <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`h-10 px-4 flex items-center text-xs font-bold uppercase tracking-wider border rounded-xl transition-all duration-300 active:scale-95 ${
            fullWidth ? 'w-full justify-between gap-3' : 'gap-2.5'
          } ${
            isOpen
              ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
              : "bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm"
          }`}
        >
          <span className="flex items-center gap-1.5 overflow-hidden">
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0"></span>
            <span className="truncate">{selectedOption.label}</span>
          </span>
          <div className={`w-4 h-4 flex items-center justify-center rounded-full transition-all duration-300 ${isOpen ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
            <ChevronDown
              size={10}
              strokeWidth={3}
              className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {isOpen && (
          <div className={`absolute left-0 top-[calc(100%+6px)] min-w-[12rem] max-w-xs ${fullWidth ? 'w-full' : 'w-max'} bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-[0_12px_40px_-10px_rgb(0,0,0,0.15)] overflow-hidden z-[100] ring-1 ring-black/5`}>
            <div className="p-1.5 flex flex-col gap-0.5 max-h-[170px] overflow-y-auto custom-scrollbar">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-lg flex items-center justify-between transition-all duration-200 ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20 translate-x-1"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:translate-x-1"
                    }`}
                  >
                    {opt.label}
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                        <Check size={10} strokeWidth={4} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
