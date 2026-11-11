import { Injectable } from '@nestjs/common';

import { SupabaseRestService } from '../supabase/supabase-rest.service.js';

interface LinhaEquipamento {
  id: string;
  patrimonio: string;
  nome: string;
  categoria: string;
  situacao: 'disponivel' | 'emprestado' | 'manutencao';
  imagem_path: string;
  foto_pexels_id: number;
  foto_fotografo: string;
  foto_fotografo_url: string;
  foto_pagina_url: string;
  foto_licenca: string;
}

export interface Equipamento {
  id: string;
  patrimonio: string;
  nome: string;
  categoria: string;
  situacao: LinhaEquipamento['situacao'];
  comigo: boolean;
  imagemUrl: string;
  foto: {
    fotografo: string;
    fotografoUrl: string;
    paginaUrl: string;
    licenca: string;
  };
}

const COLUNAS =
  'id,patrimonio,nome,categoria,situacao,imagem_path,foto_pexels_id,' +
  'foto_fotografo,foto_fotografo_url,foto_pagina_url,foto_licenca';

@Injectable()
export class EquipamentosService {
  constructor(private readonly supabase: SupabaseRestService) {}

  async listar(token: string): Promise<Equipamento[]> {
    const [linhas, meusAbertos] = await Promise.all([
      this.supabase.requisitar<LinhaEquipamento[]>(
        token,
        `/equipamentos?select=${COLUNAS}&order=patrimonio.asc`,
      ),
      // RLS: só os empréstimos da própria pessoa voltam.
      this.supabase.requisitar<{ equipamento_id: string }[]>(
        token,
        '/emprestimos?select=equipamento_id&devolvido_em=is.null',
      ),
    ]);
    const comigo = new Set(meusAbertos.map((e) => e.equipamento_id));

    return linhas.map((linha) => ({
      id: linha.id,
      patrimonio: linha.patrimonio,
      nome: linha.nome,
      categoria: linha.categoria,
      situacao: linha.situacao,
      comigo: comigo.has(linha.id),
      imagemUrl: this.supabase.urlPublicaDaImagem(linha.imagem_path, linha.foto_pexels_id),
      foto: {
        fotografo: linha.foto_fotografo,
        fotografoUrl: linha.foto_fotografo_url,
        paginaUrl: linha.foto_pagina_url,
        licenca: linha.foto_licenca,
      },
    }));
  }
}
