import React from 'react';

interface SelectOption {
  value: number | string;
  label: string;
}

interface SmartSelectProps {
  label: string;
  value: any;
  onChange: (val: any) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  isModified?: boolean;
}

// Helper to identify missing fields (null, undefined, or empty string)
const isMissing = (value: any): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
};

export const SmartSelect: React.FC<SmartSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = true,
  isModified = false
}) => {
  const missing = required && isMissing(value);

  return (
    <div className={`group relative p-4 rounded-lg border transition-all duration-300 ${
      missing 
        ? 'bg-k2-black border-k2-grey hover:border-k2-grey' 
        : 'bg-k2-black border-k2-blue hover:border-k2-blue'
    }`}>
      <div className="flex justify-between items-start mb-2.5">
        <label className="text-xs font-semibold text-k2-grey uppercase tracking-wider flex items-center gap-2" style={{ fontWeight: 600 }}>
          {label}
          {missing ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-k2-grey/20 text-k2-grey border border-k2-grey tracking-wide" style={{ fontWeight: 600 }}>
              MISSING
            </span>
          ) : isModified ? (
            <span className="inline-flex items-center text-[10px] font-semibold text-k2-blue tracking-wide" style={{ fontWeight: 600 }}>
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              MANUAL
            </span>
          ) : (
             <span className="inline-flex items-center text-[10px] font-semibold text-k2-green tracking-wide" style={{ fontWeight: 600 }}>
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              EXTRACTED
            </span>
          )}
        </label>
      </div>

      <select
        value={value === null || value === undefined ? '' : value.toString()}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') {
            onChange(null);
          } else {
            // Try to convert to number if all options are numbers
            const selectedOption = options.find(opt => opt.value.toString() === v);
            if (selectedOption) {
              onChange(selectedOption.value);
            } else {
              onChange(v);
            }
          }
        }}
        className={`w-full bg-k2-black text-sm rounded-md px-3 py-2.5 outline-none focus:ring-1 transition-all font-light ${
          missing 
            ? 'text-white border border-k2-grey focus:ring-k2-grey focus:border-k2-grey' 
            : 'text-white border border-k2-blue focus:ring-k2-blue focus:border-k2-blue'
        }`}
        style={{ fontWeight: 300 }}
      >
        <option value="">{placeholder || (missing ? "Required..." : "Select...")}</option>
        {options.map((option) => (
          <option key={option.value.toString()} value={option.value.toString()}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

