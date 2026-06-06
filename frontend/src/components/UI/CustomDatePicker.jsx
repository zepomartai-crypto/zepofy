import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ChevronDown } from 'lucide-react';
import dayjs from 'dayjs';

const CustomDatePicker = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(dayjs(value || new Date()));
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

  const selectedDate = value ? dayjs(value) : null;
  const daysInMonth = currentMonth.daysInMonth();
  const startDay = currentMonth.startOf('month').day();
  const monthName = currentMonth.format('MMMM');
  const year = currentMonth.format('YYYY');

  const days = [];
  for (let i = 0; i < startDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const date = currentMonth.date(i);
    const isSelected = selectedDate && date.isSame(selectedDate, 'day');
    const isToday = date.isSame(dayjs(), 'day');
    const isPast = date.isBefore(dayjs(), 'day');

    days.push(
      <button
        key={i}
        type="button"
        disabled={isPast}
        onClick={() => {
          onChange(date.format('YYYY-MM-DD'));
          setIsOpen(false);
        }}
        className={`h-8 w-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all ${
          isSelected
            ? 'bg-blue-600 text-white shadow-md'
            : isPast
            ? 'text-slate-300 cursor-not-allowed'
            : isToday
            ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        {i}
      </button>
    );
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-[13px] font-bold text-slate-900 shadow-sm flex items-center justify-between"
      >
        <span>{selectedDate ? selectedDate.format('YYYY-MM-DD') : 'Select Date'}</span>
        <ChevronDown size={20} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[280px] bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 z-50 p-4 animate-in fade-in slide-in-from-top-2">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCurrentMonth(currentMonth.subtract(1, 'month')); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-[14px] font-bold text-slate-900">
              {monthName} {year}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCurrentMonth(currentMonth.add(1, 'month')); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="h-8 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
