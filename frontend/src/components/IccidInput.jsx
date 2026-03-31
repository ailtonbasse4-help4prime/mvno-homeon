import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { CreditCard, Check, X, Loader2, Search, ChevronDown } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * IccidInput - Componente inteligente para seleção/digitação de ICCID
 * 
 * Features:
 * - Digitação manual com validação em tempo real
 * - Autocomplete com sugestões de ICCIDs disponíveis
 * - Dropdown para seleção rápida
 * - Validação: existe no banco, status disponível
 * - Formatação automática (remove espaços)
 * - Suporte a colar ICCID
 */
export function IccidInput({
  value,
  onChange,
  onChipSelect,
  chips = [],
  disabled = false,
  className,
  ...props
}) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [validationState, setValidationState] = useState(null); // null, 'loading', 'valid', 'invalid', 'used'
  const [validationMessage, setValidationMessage] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedChipData, setSelectedChipData] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  // Chips disponíveis do props
  const availableChips = chips.filter(c => c.status === 'disponivel');

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Atualizar input quando value muda externamente
  useEffect(() => {
    if (value && chips.length > 0) {
      const chip = chips.find(c => c.id === value);
      if (chip) {
        setInputValue(chip.iccid);
        setSelectedChipData(chip);
        setValidationState('valid');
        setValidationMessage('ICCID válido e disponível');
      }
    } else if (!value) {
      setInputValue('');
      setSelectedChipData(null);
      setValidationState(null);
      setValidationMessage('');
    }
  }, [value, chips]);

  // Formatar ICCID (remover espaços e caracteres não numéricos)
  const formatIccid = (val) => {
    return val.replace(/\s+/g, '').replace(/[^0-9]/g, '');
  };

  // Validar ICCID
  const validateIccid = useCallback(async (iccid) => {
    if (!iccid || iccid.length < 5) {
      setValidationState(null);
      setValidationMessage('');
      setSelectedChipData(null);
      onChange('');
      onChipSelect?.(null);
      return;
    }

    setIsValidating(true);
    setValidationState('loading');

    try {
      // Buscar todos os chips (incluindo não disponíveis) para validação
      const response = await axios.get(`${API_URL}/api/chips`, {
        withCredentials: true
      });
      
      const allChips = response.data;
      const chip = allChips.find(c => c.iccid === iccid);

      if (!chip) {
        setValidationState('invalid');
        setValidationMessage('ICCID não encontrado no sistema');
        setSelectedChipData(null);
        onChange('');
        onChipSelect?.(null);
      } else if (chip.status === 'disponivel') {
        setValidationState('valid');
        setValidationMessage('ICCID válido e disponível');
        setSelectedChipData(chip);
        onChange(chip.id);
        onChipSelect?.(chip);
      } else if (chip.status === 'ativado') {
        setValidationState('used');
        setValidationMessage('ICCID já está ativado em outra linha');
        setSelectedChipData(chip);
        onChange('');
        onChipSelect?.(null);
      } else if (chip.status === 'bloqueado') {
        setValidationState('used');
        setValidationMessage('ICCID está bloqueado');
        setSelectedChipData(chip);
        onChange('');
        onChipSelect?.(null);
      } else {
        setValidationState('used');
        setValidationMessage(`ICCID com status: ${chip.status}`);
        setSelectedChipData(chip);
        onChange('');
        onChipSelect?.(null);
      }
    } catch (error) {
      console.error('Erro ao validar ICCID:', error);
      setValidationState('invalid');
      setValidationMessage('Erro ao verificar ICCID');
      setSelectedChipData(null);
      onChange('');
      onChipSelect?.(null);
    } finally {
      setIsValidating(false);
    }
  }, [onChange, onChipSelect]);

  // Debounce da validação
  const debouncedValidate = useCallback((iccid) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      validateIccid(iccid);
    }, 500);
  }, [validateIccid]);

  // Atualizar sugestões baseado no input
  useEffect(() => {
    if (inputValue.length >= 3) {
      const filtered = availableChips.filter(chip => 
        chip.iccid.includes(inputValue)
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions(availableChips.slice(0, 5));
    }
  }, [inputValue, availableChips]);

  // Handler de input
  const handleInputChange = (e) => {
    const formatted = formatIccid(e.target.value);
    setInputValue(formatted);
    debouncedValidate(formatted);
    
    // Abrir dropdown se tiver sugestões
    if (formatted.length >= 1) {
      setIsOpen(true);
    }
  };

  // Handler de paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const formatted = formatIccid(pasted);
    setInputValue(formatted);
    debouncedValidate(formatted);
  };

  // Selecionar chip da lista
  const handleSelectChip = (chip) => {
    setInputValue(chip.iccid);
    setSelectedChipData(chip);
    setValidationState('valid');
    setValidationMessage('ICCID válido e disponível');
    onChange(chip.id);
    onChipSelect?.(chip);
    setIsOpen(false);
  };

  // Limpar seleção
  const handleClear = () => {
    setInputValue('');
    setSelectedChipData(null);
    setValidationState(null);
    setValidationMessage('');
    onChange('');
    onChipSelect?.(null);
    inputRef.current?.focus();
  };

  // Ícone de status
  const StatusIcon = () => {
    if (isValidating || validationState === 'loading') {
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    }
    if (validationState === 'valid') {
      return <Check className="w-4 h-4 text-emerald-500" />;
    }
    if (validationState === 'invalid' || validationState === 'used') {
      return <X className="w-4 h-4 text-red-500" />;
    }
    return <CreditCard className="w-4 h-4 text-zinc-500" />;
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Input principal */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
          <StatusIcon />
        </div>
        
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onFocus={() => setIsOpen(true)}
          placeholder="Digite ou selecione um ICCID"
          disabled={disabled}
          className={cn(
            "form-input pl-10 pr-20 font-mono",
            validationState === 'valid' && "border-emerald-500/50 focus:border-emerald-500",
            (validationState === 'invalid' || validationState === 'used') && "border-red-500/50 focus:border-red-500"
          )}
          data-testid="iccid-input"
          {...props}
        />

        {/* Botões de ação */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              data-testid="iccid-clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            data-testid="iccid-dropdown-toggle"
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Mensagem de validação */}
      {validationMessage && (
        <p 
          className={cn(
            "text-xs mt-1.5 flex items-center gap-1",
            validationState === 'valid' && "text-emerald-500",
            (validationState === 'invalid' || validationState === 'used') && "text-red-400",
            validationState === 'loading' && "text-blue-400"
          )}
          data-testid="iccid-validation-message"
        >
          {validationMessage}
        </p>
      )}

      {/* Dropdown de sugestões */}
      {isOpen && !disabled && (
        <div 
          className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-sm shadow-xl max-h-60 overflow-y-auto"
          data-testid="iccid-suggestions"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-950/50">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Search className="w-3 h-3" />
              <span>{availableChips.length} chips disponíveis</span>
            </div>
          </div>

          {/* Lista de sugestões */}
          {suggestions.length > 0 ? (
            <div className="py-1">
              {suggestions.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleSelectChip(chip)}
                  className={cn(
                    "w-full px-3 py-2.5 text-left hover:bg-zinc-800/50 transition-colors flex items-center justify-between group",
                    selectedChipData?.id === chip.id && "bg-blue-500/10"
                  )}
                  data-testid={`iccid-option-${chip.id}`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-zinc-500 group-hover:text-emerald-500" />
                    <span className="font-mono text-sm text-white">{chip.iccid}</span>
                  </div>
                  <span className="text-xs text-emerald-500 px-2 py-0.5 bg-emerald-500/10 rounded">
                    disponível
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 text-center text-sm text-zinc-500">
              {inputValue.length >= 3 
                ? 'Nenhum ICCID encontrado com este filtro'
                : 'Nenhum chip disponível'
              }
            </div>
          )}

          {/* Footer com dica */}
          {availableChips.length > 5 && suggestions.length === 5 && (
            <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-950/50">
              <p className="text-xs text-zinc-500">
                Digite para filtrar mais resultados
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info do chip selecionado */}
      {selectedChipData && validationState === 'valid' && (
        <div className="mt-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-emerald-400">Chip selecionado</span>
            </div>
            <span className="text-xs text-zinc-500">
              {new Date(selectedChipData.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
