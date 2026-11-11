import { z } from 'zod';

// ADR-001: Zod valida a entrada de cada endpoint.
export const SolicitarEmprestimoSchema = z.object({
  equipamentoId: z.uuid(),
});

export type SolicitarEmprestimo = z.infer<typeof SolicitarEmprestimoSchema>;
