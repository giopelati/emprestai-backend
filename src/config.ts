import { HttpException, HttpStatus } from '@nestjs/common';

export interface ConfigSupabase {
  url: string;
  chavePublica: string;
}

// ADR-003: o backend só usa variáveis públicas do Supabase.
export function lerConfigSupabase(): ConfigSupabase {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const chavePublica = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !chavePublica) {
    throw new HttpException(
      {
        codigo: 'CONFIGURACAO_AUSENTE',
        mensagem: 'O servidor não está configurado. Fale com o time.',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
  return { url, chavePublica };
}
