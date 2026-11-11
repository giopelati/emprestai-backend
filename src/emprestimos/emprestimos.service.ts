import { Injectable } from '@nestjs/common';

import { SupabaseRestService } from '../supabase/supabase-rest.service.js';

export const LIMITE_DE_EMPRESTIMOS = 3;
export const PRAZO_EM_DIAS = 14;

interface LinhaEmprestimo {
  id: string;
  equipamento_id: string;
  retirado_em: string;
  devolucao_prevista: string;
}

interface LinhaMeuEmprestimo {
  id: string;
  retirado_em: string;
  devolucao_prevista: string;
  equipamento: {
    id: string;
    patrimonio: string;
    nome: string;
    categoria: string;
    imagem_path: string;
    foto_pexels_id: number;
    foto_fotografo: string;
  };
}

export interface EmprestimoCriado {
  id: string;
  equipamentoId: string;
  retiradoEm: string;
  devolucaoPrevista: string;
}

export interface MeuEmprestimo {
  id: string;
  retiradoEm: string;
  devolucaoPrevista: string;
  atrasado: boolean;
  equipamento: {
    id: string;
    patrimonio: string;
    nome: string;
    categoria: string;
    imagemUrl: string;
    fotografo: string;
  };
}

export interface MeusEmprestimos {
  limite: number;
  prazoEmDias: number;
  emprestimos: MeuEmprestimo[];
}

// Spec 003, L3: "hoje" é a data civil em America/Sao_Paulo.
export function hojeEmSaoPaulo(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

@Injectable()
export class EmprestimosService {
  constructor(private readonly supabase: SupabaseRestService) {}

  // A regra inteira roda numa transação do banco (public.solicitar_emprestimo).
  async solicitar(token: string, equipamentoId: string): Promise<EmprestimoCriado> {
    const linha = await this.supabase.requisitar<LinhaEmprestimo>(
      token,
      '/rpc/solicitar_emprestimo',
      { method: 'POST', body: JSON.stringify({ p_equipamento_id: equipamentoId }) },
    );
    return {
      id: linha.id,
      equipamentoId: linha.equipamento_id,
      retiradoEm: linha.retirado_em,
      devolucaoPrevista: linha.devolucao_prevista,
    };
  }

  async meus(token: string): Promise<MeusEmprestimos> {
    const linhas = await this.supabase.requisitar<LinhaMeuEmprestimo[]>(
      token,
      '/emprestimos?select=id,retirado_em,devolucao_prevista,' +
        'equipamento:equipamentos(id,patrimonio,nome,categoria,imagem_path,foto_pexels_id,foto_fotografo)' +
        '&devolvido_em=is.null&order=devolucao_prevista.asc,retirado_em.asc',
    );
    const hoje = hojeEmSaoPaulo();
    return {
      limite: LIMITE_DE_EMPRESTIMOS,
      prazoEmDias: PRAZO_EM_DIAS,
      emprestimos: linhas.map((linha) => ({
        id: linha.id,
        retiradoEm: linha.retirado_em,
        devolucaoPrevista: linha.devolucao_prevista,
        atrasado: linha.devolucao_prevista < hoje,
        equipamento: {
          id: linha.equipamento.id,
          patrimonio: linha.equipamento.patrimonio,
          nome: linha.equipamento.nome,
          categoria: linha.equipamento.categoria,
          imagemUrl: this.supabase.urlPublicaDaImagem(
            linha.equipamento.imagem_path,
            linha.equipamento.foto_pexels_id,
          ),
          fotografo: linha.equipamento.foto_fotografo,
        },
      })),
    };
  }
}
