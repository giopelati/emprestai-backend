import { Injectable } from '@nestjs/common';

import { lerConfigSupabase } from '../config.js';
import { erro, traduzirErroPostgrest } from '../erros.js';

// ADR-003: acesso a dados pela API REST do Supabase, com o JWT da pessoa.
// O Supabase valida o token e aplica RLS com a identidade dela.
@Injectable()
export class SupabaseRestService {
  async requisitar<T>(token: string, caminho: string, init: RequestInit = {}): Promise<T> {
    const { url, chavePublica } = lerConfigSupabase();
    let resposta: Response;
    try {
      resposta = await fetch(`${url}/rest/v1${caminho}`, {
        ...init,
        headers: {
          apikey: chavePublica,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(init.headers as Record<string, string> | undefined),
        },
      });
    } catch {
      throw erro('ERRO_INESPERADO');
    }
    const texto = await resposta.text();
    let corpo: unknown = null;
    try {
      corpo = texto ? JSON.parse(texto) : null;
    } catch {
      corpo = null;
    }
    if (!resposta.ok) {
      throw traduzirErroPostgrest(resposta.status, corpo);
    }
    return corpo as T;
  }

  urlPublicaDaImagem(caminho: string, versao: number | string): string {
    const { url } = lerConfigSupabase();
    return `${url}/storage/v1/object/public/equipamentos/${encodeURIComponent(caminho)}?v=${versao}`;
  }
}
