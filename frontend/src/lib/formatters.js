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
    const d = new Date(isoDateTime);
    if (isNaN(d.getTime())) return isoDateTime;
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
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
