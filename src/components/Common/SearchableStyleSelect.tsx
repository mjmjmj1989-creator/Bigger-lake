import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Plus, Sparkles, ChevronDown, Check, X } from 'lucide-react';

interface SearchableStyleSelectProps {
  value: string;
  onChange: (value: string) => void;
  onAddNewStyle?: (newStyle: string) => void;
  styles: string[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
}

export const SearchableStyleSelect: React.FC<SearchableStyleSelectProps> = ({
  value,
  onChange,
  onAddNewStyle,
  styles,
  placeholder = 'Select or type a beer style...',
  className = '',
  inputClassName = '',
  autoFocus = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal search term when external value changes
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  // Filter styles based on search term
  const filteredStyles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return styles;
    return styles.filter((s) => s.toLowerCase().includes(term));
  }, [styles, searchTerm]);

  // Check if current search term is an exact match for an existing style
  const exactMatch = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return styles.find((s) => s.toLowerCase() === term);
  }, [styles, searchTerm]);

  const hasNewCustomOption = searchTerm.trim().length > 0 && !exactMatch;

  const handleSelectExisting = (selected: string) => {
    onChange(selected);
    setSearchTerm(selected);
    setIsOpen(false);
  };

  const handleSelectNewCustom = (customStyle: string) => {
    const trimmed = customStyle.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setSearchTerm(trimmed);
    if (onAddNewStyle) {
      onAddNewStyle(trimmed);
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (hasNewCustomOption) {
        handleSelectNewCustom(searchTerm);
      } else if (filteredStyles.length > 0) {
        handleSelectExisting(filteredStyles[0]);
      } else if (searchTerm.trim()) {
        handleSelectNewCustom(searchTerm);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Searchable Input Bar */}
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl pl-9 pr-14 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${inputClassName}`}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                onChange('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Toggle style options"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-slate-900 border border-slate-750 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-800/80 animate-in fade-in duration-100">
          {/* On-the-Fly Custom Style Option: '+ Use "[Entered Style]"' */}
          {hasNewCustomOption && (
            <div
              onClick={() => handleSelectNewCustom(searchTerm)}
              className="p-2.5 bg-amber-500/15 hover:bg-amber-500/25 border-b border-amber-500/30 flex items-center justify-between cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <div className="text-xs">
                  <span className="font-bold text-amber-300">
                    + Use &quot;<span className="text-white underline">{searchTerm.trim()}</span>&quot;
                  </span>
                  <span className="block text-[10px] text-amber-400/80 font-medium">
                    Creates dynamic style & saves to master Google Sheet
                  </span>
                </div>
              </div>
              <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
          )}

          {/* Existing Filtered Styles */}
          {filteredStyles.length > 0 ? (
            <div className="p-1 space-y-0.5">
              {filteredStyles.map((style) => {
                const isSelected = value.toLowerCase() === style.toLowerCase();
                return (
                  <div
                    key={style}
                    onClick={() => handleSelectExisting(style)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-300 font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span>{style}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 stroke-[3]" />}
                  </div>
                );
              })}
            </div>
          ) : (
            !hasNewCustomOption && (
              <div className="p-3 text-center text-xs text-slate-500">
                No matching styles found.
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
