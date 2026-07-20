import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export const FilterDropdown = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${isOpen ? 'z-[70]' : 'z-20'}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(open => !open)}
        className={`flex h-[56px] w-full items-center gap-3 rounded-2xl border bg-white px-4 text-left transition-all duration-200 cursor-pointer ${
          disabled ?
             'border-[#E5E7EB] opacity-60'
            : isOpen ?
               'border-[#93C5FD] shadow-[0_10px_24px_rgba(37,99,235,0.10)]'
              : 'border-[#E5E7EB] hover:border-[#DBEAFE] hover:shadow-sm'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#111827]">{selected?.label || placeholder}</span>
        <ChevronDown size={18} className={`shrink-0 text-[#6B7280] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-[calc(100%+10px)] z-[80] w-max min-w-[260px] max-w-[340px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 hover:translate-x-1 ${
              !value ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
            }`}
          >
            <span>{placeholder}</span>
            {!value && <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />}
          </button>
          {options.map(option => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 hover:translate-x-1 ${
                  isSelected ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                }`}
              >
                <span>{option.label}</span>
                {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
