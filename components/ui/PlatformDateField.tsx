import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../../utils';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEK_DAYS = ['do.', 'lu.', 'ma.', 'mi.', 'ju.', 'vi.', 'sa.'];

const parseIsoDate = (value: string) => {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildCalendarDays = (monthDate: Date) => {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + index);
    return day;
  });
};

type PlatformDateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  buttonClassName?: string;
};

export const PlatformDateField: React.FC<PlatformDateFieldProps> = ({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  disabled,
  required,
  className = '',
  buttonClassName = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() => {
    const base = value ? parseIsoDate(value) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (!value) return;
    const base = parseIsoDate(value);
    setDisplayMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedDate = value ? parseIsoDate(value) : null;
  const calendarDays = useMemo(() => buildCalendarDays(displayMonth), [displayMonth]);
  const todayIso = toIsoDate(new Date());

  return (
    <div ref={containerRef} className={`relative ${isOpen ? 'z-[120]' : 'z-20'} ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-required={required}
        onClick={() => setIsOpen(open => !open)}
        className={`flex h-[56px] w-full items-center justify-between gap-3 rounded-2xl border bg-white px-4 text-left outline-none transition-all duration-200 ${
          disabled
            ? 'cursor-not-allowed border-[#E5E7EB] opacity-60'
            : isOpen
              ? 'border-[#111827] shadow-[0_16px_36px_rgba(15,23,42,0.10)]'
              : 'border-[#E5E7EB] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] focus-visible:border-[#111827]'
        } ${buttonClassName}`}
      >
        <span className={`min-w-0 flex-1 truncate text-[16px] font-semibold tracking-[-0.01em] ${value ? 'text-[#111827]' : 'text-[#94A3B8]'}`}>
          {value ? formatDate(value) : placeholder}
        </span>
        <Calendar size={18} className="shrink-0 text-[#2563EB]" />
      </button>

      {isOpen && !disabled ? (
        <div className="absolute left-0 top-[calc(100%+10px)] z-[130] w-[320px] max-w-[calc(100vw-3rem)] rounded-[28px] border border-[#E5E7EB] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)] animate-[platform-fade-in_180ms_ease-out]">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setDisplayMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-[#E5E7EB] text-[#64748B] transition-all duration-200 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-[15px] font-black text-[#111827]">
              {MONTHS[displayMonth.getMonth()]} de {displayMonth.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => setDisplayMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-[#E5E7EB] text-[#64748B] transition-all duration-200 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2">
            {WEEK_DAYS.map(day => (
              <div key={day} className="text-center text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                {day}
              </div>
            ))}

            {calendarDays.map(day => {
              const dayIso = toIsoDate(day);
              const isSelected = !!selectedDate && dayIso === toIsoDate(selectedDate);
              const isCurrentMonth = day.getMonth() === displayMonth.getMonth();
              const isToday = dayIso === todayIso;

              return (
                <button
                  key={dayIso}
                  type="button"
                  onClick={() => {
                    onChange(dayIso);
                    setIsOpen(false);
                  }}
                  className={`flex h-10 items-center justify-center rounded-2xl text-[14px] font-semibold transition-all duration-200 ${
                    isSelected
                      ? 'bg-[#DBEAFE] text-[#2563EB] shadow-[0_10px_24px_rgba(37,99,235,0.12)]'
                      : isToday
                        ? 'border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                        : isCurrentMonth
                          ? 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                          : 'text-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[#E5E7EB] pt-4">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="cursor-pointer text-[14px] font-semibold text-[#64748B] transition-colors duration-200 hover:text-[#2563EB]"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todayIso);
                setIsOpen(false);
              }}
              className="cursor-pointer text-[14px] font-semibold text-[#2563EB] transition-colors duration-200 hover:text-[#1D4ED8]"
            >
              Hoy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
