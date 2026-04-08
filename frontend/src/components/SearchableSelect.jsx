import { useState, useRef, useEffect } from 'react';
import { Input } from './ui/input';
import { ChevronDown, Search, X } from 'lucide-react';

export function SearchableSelect({ value, onValueChange, options, placeholder = 'Selecione...', searchPlaceholder = 'Buscar...', disabled = false, testId = 'searchable-select' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find(o => o.value === value);

  const filtered = options.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (o.label || '').toLowerCase().includes(q) || (o.sublabel || '').toLowerCase().includes(q);
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative" data-testid={testId}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="form-input w-full flex items-center justify-between gap-2 text-left min-h-[40px] px-3 py-2"
        data-testid={`${testId}-trigger`}
      >
        <span className={`truncate text-sm ${selected ? 'text-white' : 'text-zinc-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden" data-testid={`${testId}-dropdown`}>
          <div className="p-2 border-b border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md pl-8 pr-8 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                data-testid={`${testId}-search`}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-zinc-500 text-sm">Nenhum resultado</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onValueChange(option.value);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-800 transition-colors flex flex-col ${option.value === value ? 'bg-blue-950/50 border-l-2 border-blue-500' : ''}`}
                  data-testid={`${testId}-option-${option.value}`}
                >
                  <span className="text-white">{option.label}</span>
                  {option.sublabel && <span className="text-xs text-zinc-500">{option.sublabel}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
