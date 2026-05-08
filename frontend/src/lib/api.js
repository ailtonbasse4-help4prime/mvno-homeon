/**
 * Utilitario para normalizar respostas da API.
 * Garante que o frontend nunca crasha mesmo se a API
 * retornar formato inesperado (HTML, objeto, null, etc).
 */

const ARRAY_KEYS = ['data', 'items', 'results', 'planos', 'clientes', 'ofertas', 'linhas', 'chips', 'logs', 'usuarios', 'cobrancas', 'assinaturas'];

/**
 * Extrai um array seguro de qualquer resposta de API.
 * - Se for array, retorna direto.
 * - Se for objeto com chave conhecida contendo array, extrai.
 * - Senao, retorna [].
 */
export function safeArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const key of ARRAY_KEYS) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  return [];
}

/**
 * Extrai um objeto seguro de qualquer resposta de API.
 * - Se for objeto (nao array), retorna direto.
 * - Senao, retorna fallback.
 */
export function safeObject(data, fallback = null) {
  if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  return fallback;
}
