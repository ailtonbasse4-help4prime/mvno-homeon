// Helpers de formatacao
export const formatDateBR = (isoDate) => {
  if (!isoDate) return '—';
  try {
    const s = String(isoDate).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return isoDate;
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return isoDate;
  }
};

export const formatDateTimeBR = (isoDateTime) => {
  if (!isoDateTime) return '—';
  try {
    // Backend salva UTC. Se nao houver marker de timezone (Z ou +HH:MM), assumimos UTC.
    const s = String(isoDateTime);
    const hasTZ = s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s);
    const d = new Date(hasTZ ? s : s + 'Z');
    if (isNaN(d.getTime())) return isoDateTime;
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return isoDateTime;
  }
};

// Converte DD/MM/YYYY de volta para YYYY-MM-DD (ISO) para enviar ao backend
export const parseDateBR = (brDate) => {
  if (!brDate) return '';
  const m = String(brDate).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return brDate;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

// Formata valor monetario em padrao BR: "R$ 1.234,56"
export const brl = (n) => {
  const num = Number(n || 0);
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Formata numero sem simbolo: "1.234,56"
export const fmtNum = (n, digits = 2) => {
  const num = Number(n || 0);
  return num.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
