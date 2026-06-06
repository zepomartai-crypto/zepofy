import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

const CustomTimePicker = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  let hour = '12';
  let minute = '00';
  let period = 'AM';

  if (value) {
    const parts = value.split(':');
    let h = parseInt(parts[0], 10);
    minute = parts[1] || '00';
    period = h >= 12 ? 'PM' : 'AM';
    hour = (h % 12 || 12).toString().padStart(2, '0');
  }

  const handleTimeChange = (type, val) => {
    let newHour = parseInt(hour, 10);
    let newMinute = minute;
    let newPeriod = period;

    if (type === 'hour') newHour = parseInt(val, 10);
    if (type === 'minute') newMinute = val;
    if (type === 'period') newPeriod = val;

    let h24 = newHour;
    if (newPeriod === 'PM' && newHour !== 12) h24 += 12;
    if (newPeriod === 'AM' && newHour === 12) h24 = 0;

    const formattedTime = `${h24.toString().padStart(2, '0')}:${newMinute}`;
    onChange(formattedTime);
  };

  const formattedDisplay = `${hour}:${minute} ${period}`;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-[13px] font-bold text-slate-900 shadow-sm flex items-center justify-between"
      >
        <span>{formattedDisplay}</span>
        <ChevronDown size={20} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 z-50 p-2 animate-in fade-in slide-in-from-top-2 flex gap-1 h-[200px]">
          {/* Hours Column */}
          <div className="overflow-y-auto custom-scrollbar flex flex-col gap-1 px-1">
            {Array.from({ length: 12 }).map((_, i) => {
              const h = (i + 1).toString().padStart(2, '0');
              const isSelected = h === hour;
              return (
                <button
                  key={`h-${h}`}
                  type="button"
                  onClick={() => handleTimeChange('hour', h)}
                  className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-colors ${
                    isSelected ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {h}
                </button>
              );
            })}
          </div>

          {/* Minutes Column */}
          <div className="overflow-y-auto custom-scrollbar flex flex-col gap-1 px-1 border-l border-slate-100">
            {Array.from({ length: 60 }).map((_, i) => {
              const m = i.toString().padStart(2, '0');
              const isSelected = m === minute;
              return (
                <button
                  key={`m-${m}`}
                  type="button"
                  onClick={() => handleTimeChange('minute', m)}
                  className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-colors ${
                    isSelected ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>

          {/* AM/PM Column */}
          <div className="flex flex-col gap-1 px-1 border-l border-slate-100">
            {['AM', 'PM'].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  handleTimeChange('period', p);
                  setIsOpen(false);
                }}
                className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-colors ${
                  period === p ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomTimePicker;
