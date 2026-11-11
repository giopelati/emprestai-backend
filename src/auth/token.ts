import { erro } from '../erros.js';

// Extrai o JWT do cabeçalho Authorization. A validação de verdade é feita pelo
// Supabase a cada chamada (ADR-003); aqui só se recusa o que nem é Bearer.
export function extrairToken(autorizacao: string | undefined): string {
  const token = /^Bearer\s+(\S+)$/i.exec(autorizacao?.trim() ?? '')?.[1];
  if (!token) {
    throw erro('NAO_AUTENTICADO');
  }
  return token;
}
