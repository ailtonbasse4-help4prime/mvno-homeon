/**
 * Helpers de formatacao de data/hora em BRT (America/Sao_Paulo).
 *
 * PROBLEMA que resolve: backend salva datetime UTC. Ao serializar JSON pode vir
 * sem sufixo 'Z'. JS entao interpreta como local time e mostra date/hora errada.
 *
 * SOLUCAO: se o string nao tiver timezone marker (Z ou +HH:MM), assumimos UTC
 * (que e o que o backend salva) e forcamos display em timezone Sao Paulo.
 */

function parseAsUTC(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  const s = String(raw);
  // Ja tem timezone (Z ou +/-HH:MM)?
  const hasTZ = s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s);
  const iso = hasTZ ? s : s + 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

const TZ = 'America/Sao_Paulo';

export function formatDateBR(iso, fallback = '—') {
  const d = parseAsUTC(iso);
  if (!d) return fallback;
  return d.toLocaleDateString('pt-BR', { timeZone: TZ });
}

export function formatTimeBR(iso, fallback = '—') {
  const d = parseAsUTC(iso);
  if (!d) return fallback;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

export function formatDateTimeBR(iso, fallback = '—') {
  const d = parseAsUTC(iso);
  if (!d) return fallback;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: TZ,
  });
}

/** Aceita "YYYY-MM-DD" (data pura, sem hora/timezone) e retorna DD/MM/YYYY sem conversao de fuso. */
export function formatDateOnlyBR(iso, fallback = '—') {
  if (!iso) return fallback;
  const s = String(iso).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return fallback;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
