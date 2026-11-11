// Spec 003 — solicitar empréstimo. API do backend contra o Supabase local.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import { AppModule } from '../src/app.module.js';
import {
  admin,
  comoPessoa,
  configLocal,
  criarUsuario,
  limparDados,
} from './apoio/supabase-local.js';
import type { UsuarioTeste } from './apoio/supabase-local.js';

interface Resposta<T = any> {
  status: number;
  corpo: T;
}

interface LinhaEquipamento {
  id: string;
  patrimonio: string;
  situacao: string;
}

let app: INestApplication;
let base = '';

const MENSAGENS = {
  NAO_AUTENTICADO: 'Sua sessão expirou. Entre novamente.',
  PAPEL_INVALIDO: 'Seu acesso ainda não foi configurado. Fale com Operações.',
  ENTRADA_INVALIDA: 'Informe um equipamento válido.',
  EQUIPAMENTO_NAO_ENCONTRADO: 'Equipamento não encontrado.',
  EQUIPAMENTO_INDISPONIVEL: 'Este equipamento não está disponível para empréstimo.',
  EMPRESTIMO_EM_ATRASO:
    'Você tem empréstimo em atraso. Devolva o item atrasado para solicitar outro.',
  LIMITE_DE_EMPRESTIMOS: 'Você já está com 3 itens emprestados. Devolva um para solicitar outro.',
};

async function api<T = any>(
  token: string | null,
  metodo: string,
  caminho: string,
  corpo?: unknown,
): Promise<Resposta<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

function hojeMais(dias: number): string {
  const hoje = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const data = new Date(`${hoje}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

// 7 disponíveis e 1 em manutenção, recriados antes de cada teste.
async function semearEquipamentos(): Promise<Record<string, LinhaEquipamento>> {
  const base = 700000 + Math.floor(Math.random() * 100000) * 10;
  const linhas = Array.from({ length: 8 }, (_, i) => ({
    patrimonio: `TI-${String(9000 + i)}`,
    nome: `Equipamento de teste ${i}`,
    categoria: 'cabo',
    situacao: i === 7 ? 'manutencao' : 'disponivel',
    imagem_path: `TI-${9000 + i}.jpg`,
    foto_pexels_id: base + i,
    foto_fotografo: 'Teste',
    foto_fotografo_url: 'https://www.pexels.com/@teste',
    foto_pagina_url: `https://www.pexels.com/photo/${base + i}/`,
    foto_licenca: 'Licença Pexels — https://www.pexels.com/license/',
  }));
  const criadas = await admin<LinhaEquipamento[]>('/rest/v1/equipamentos?select=id,patrimonio,situacao', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(linhas),
  });
  return Object.fromEntries(criadas.map((l) => [l.patrimonio, l]));
}

async function emprestimosAbertos(filtro = ''): Promise<{ id: string }[]> {
  return admin(`/rest/v1/emprestimos?select=id&devolvido_em=is.null${filtro}`);
}

let itens: Record<string, LinhaEquipamento>;

describe('Spec 003 — solicitar empréstimo (API)', () => {
  beforeAll(async () => {
    const { url, chavePublica } = configLocal();
    process.env.SUPABASE_URL = url;
    process.env.SUPABASE_PUBLISHABLE_KEY = chavePublica;
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app?.close();
    await limparDados();
  });

  beforeEach(async () => {
    await limparDados();
    itens = await semearEquipamentos();
  });

  it('CA-11: sem token ou com token inválido responde 401 com NAO_AUTENTICADO', async () => {
    for (const [token, caminho] of [
      [null, '/equipamentos'],
      ['token-invalido', '/equipamentos'],
      [null, '/emprestimos/meus'],
    ] as const) {
      const resposta = await api(token, 'GET', caminho);
      expect(resposta.status).toBe(401);
      expect(resposta.corpo).toEqual({
        codigo: 'NAO_AUTENTICADO',
        mensagem: MENSAGENS.NAO_AUTENTICADO,
      });
    }
    const post = await api(null, 'POST', '/emprestimos', { equipamentoId: itens['TI-9000'].id });
    expect(post.status).toBe(401);
    expect(post.corpo.codigo).toBe('NAO_AUTENTICADO');
  });

  it('CA-11: pessoa sem papel válido recebe 403 com PAPEL_INVALIDO', async () => {
    const semPapel = await criarUsuario(null);
    const resposta = await api(semPapel.token, 'POST', '/emprestimos', {
      equipamentoId: itens['TI-9000'].id,
    });
    expect(resposta.status).toBe(403);
    expect(resposta.corpo).toEqual({ codigo: 'PAPEL_INVALIDO', mensagem: MENSAGENS.PAPEL_INVALIDO });
    expect(await emprestimosAbertos()).toEqual([]);
  });

  it('CA-01: catálogo lista todos os equipamentos com foto, nome, categoria, patrimônio e situação', async () => {
    const pessoa = await criarUsuario();
    const resposta = await api(pessoa.token, 'GET', '/equipamentos');
    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toHaveLength(8);
    const { url } = configLocal();
    const primeiro = resposta.corpo[0];
    expect(primeiro).toEqual({
      id: itens['TI-9000'].id,
      patrimonio: 'TI-9000',
      nome: 'Equipamento de teste 0',
      categoria: 'cabo',
      situacao: 'disponivel',
      comigo: false,
      imagemUrl: expect.stringMatching(
        new RegExp(`^${url}/storage/v1/object/public/equipamentos/TI-9000\\.jpg\\?v=\\d+$`),
      ),
      foto: {
        fotografo: 'Teste',
        fotografoUrl: 'https://www.pexels.com/@teste',
        paginaUrl: expect.stringMatching(/^https:\/\/www\.pexels\.com\/photo\//),
        licenca: expect.stringContaining('Pexels'),
      },
    });
    expect(resposta.corpo.find((e: any) => e.patrimonio === 'TI-9007').situacao).toBe('manutencao');
  });

  it('CA-04: solicitar disponível cria o empréstimo com devolução em 14 dias corridos e tira o item do disponível', async () => {
    const pessoa = await criarUsuario();
    const outra = await criarUsuario();
    const resposta = await api(pessoa.token, 'POST', '/emprestimos', {
      equipamentoId: itens['TI-9000'].id,
    });
    expect(resposta.status).toBe(201);
    expect(resposta.corpo).toEqual({
      id: expect.any(String),
      equipamentoId: itens['TI-9000'].id,
      retiradoEm: expect.any(String),
      devolucaoPrevista: hojeMais(14),
    });

    const catalogoDela = await api(pessoa.token, 'GET', '/equipamentos');
    const item = catalogoDela.corpo.find((e: any) => e.patrimonio === 'TI-9000');
    expect(item.situacao).toBe('emprestado');
    expect(item.comigo).toBe(true);

    const catalogoOutra = await api(outra.token, 'GET', '/equipamentos');
    expect(catalogoOutra.corpo.find((e: any) => e.patrimonio === 'TI-9000').comigo).toBe(false);

    const meus = await api(pessoa.token, 'GET', '/emprestimos/meus');
    expect(meus.corpo.emprestimos.map((e: any) => e.equipamento.patrimonio)).toEqual(['TI-9000']);
  });

  it('CA-05: com 3 empréstimos em aberto, o quarto é recusado com 422 LIMITE_DE_EMPRESTIMOS', async () => {
    const pessoa = await criarUsuario();
    for (const patrimonio of ['TI-9000', 'TI-9001', 'TI-9002']) {
      const ok = await api(pessoa.token, 'POST', '/emprestimos', { equipamentoId: itens[patrimonio].id });
      expect(ok.status).toBe(201);
    }
    const quarto = await api(pessoa.token, 'POST', '/emprestimos', {
      equipamentoId: itens['TI-9003'].id,
    });
    expect(quarto.status).toBe(422);
    expect(quarto.corpo).toEqual({
      codigo: 'LIMITE_DE_EMPRESTIMOS',
      mensagem: MENSAGENS.LIMITE_DE_EMPRESTIMOS,
    });
    expect(await emprestimosAbertos(`&usuario_id=eq.${pessoa.id}`)).toHaveLength(3);
    const [linha] = await admin<LinhaEquipamento[]>(
      `/rest/v1/equipamentos?select=situacao&id=eq.${itens['TI-9003'].id}`,
    );
    expect(linha.situacao).toBe('disponivel');
  });

  it('CA-06: com empréstimo em atraso, nova solicitação é recusada com 422 EMPRESTIMO_EM_ATRASO', async () => {
    const pessoa = await criarUsuario();
    const primeiro = await api(pessoa.token, 'POST', '/emprestimos', {
      equipamentoId: itens['TI-9000'].id,
    });
    await admin(`/rest/v1/emprestimos?id=eq.${primeiro.corpo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ devolucao_prevista: hojeMais(-1) }),
    });
    const resposta = await api(pessoa.token, 'POST', '/emprestimos', {
      equipamentoId: itens['TI-9001'].id,
    });
    expect(resposta.status).toBe(422);
    expect(resposta.corpo).toEqual({
      codigo: 'EMPRESTIMO_EM_ATRASO',
      mensagem: MENSAGENS.EMPRESTIMO_EM_ATRASO,
    });
    expect(await emprestimosAbertos(`&usuario_id=eq.${pessoa.id}`)).toHaveLength(1);

    // No próprio dia da devolução ainda está em dia (L2).
    await admin(`/rest/v1/emprestimos?id=eq.${primeiro.corpo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ devolucao_prevista: hojeMais(0) }),
    });
    const noDia = await api(pessoa.token, 'POST', '/emprestimos', {
      equipamentoId: itens['TI-9001'].id,
    });
    expect(noDia.status).toBe(201);
  });

  it('CA-07: manutenção e emprestado dão 409, inexistente 404, id malformado 400, e nada é criado', async () => {
    const pessoa = await criarUsuario();
    const outra = await criarUsuario();
    await api(outra.token, 'POST', '/emprestimos', { equipamentoId: itens['TI-9001'].id });

    const casos: [unknown, number, keyof typeof MENSAGENS][] = [
      [{ equipamentoId: itens['TI-9007'].id }, 409, 'EQUIPAMENTO_INDISPONIVEL'],
      [{ equipamentoId: itens['TI-9001'].id }, 409, 'EQUIPAMENTO_INDISPONIVEL'],
      [{ equipamentoId: randomUUID() }, 404, 'EQUIPAMENTO_NAO_ENCONTRADO'],
      [{ equipamentoId: 'abc' }, 400, 'ENTRADA_INVALIDA'],
      [{}, 400, 'ENTRADA_INVALIDA'],
    ];
    for (const [corpo, status, codigo] of casos) {
      const resposta = await api(pessoa.token, 'POST', '/emprestimos', corpo);
      expect(resposta.status).toBe(status);
      expect(resposta.corpo).toEqual({ codigo, mensagem: MENSAGENS[codigo] });
    }
    expect(await emprestimosAbertos(`&usuario_id=eq.${pessoa.id}`)).toEqual([]);
  });

  it('CA-08: pedidos simultâneos ao mesmo equipamento criam um único empréstimo', async () => {
    const pessoas: UsuarioTeste[] = await Promise.all(
      Array.from({ length: 5 }, () => criarUsuario()),
    );
    const respostas = await Promise.all(
      pessoas.map((p) => api(p.token, 'POST', '/emprestimos', { equipamentoId: itens['TI-9004'].id })),
    );
    const status = respostas.map((r) => r.status).sort();
    expect(status).toEqual([201, 409, 409, 409, 409]);
    for (const recusa of respostas.filter((r) => r.status === 409)) {
      expect(recusa.corpo.codigo).toBe('EQUIPAMENTO_INDISPONIVEL');
    }
    expect(await emprestimosAbertos(`&equipamento_id=eq.${itens['TI-9004'].id}`)).toHaveLength(1);
  });

  it('CA-09: meus empréstimos mostra só os próprios abertos, ordenados, com devolução e atraso', async () => {
    const pessoa = await criarUsuario();
    const vazio = await api(pessoa.token, 'GET', '/emprestimos/meus');
    expect(vazio.status).toBe(200);
    expect(vazio.corpo).toEqual({ limite: 3, prazoEmDias: 14, emprestimos: [] });

    const a = await api(pessoa.token, 'POST', '/emprestimos', { equipamentoId: itens['TI-9000'].id });
    await api(pessoa.token, 'POST', '/emprestimos', { equipamentoId: itens['TI-9001'].id });
    await admin(`/rest/v1/emprestimos?id=eq.${a.corpo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ devolucao_prevista: hojeMais(20) }),
    });

    const resposta = await api(pessoa.token, 'GET', '/emprestimos/meus');
    expect(resposta.status).toBe(200);
    expect(resposta.corpo.limite).toBe(3);
    expect(resposta.corpo.emprestimos.map((e: any) => [e.equipamento.patrimonio, e.devolucaoPrevista, e.atrasado])).toEqual([
      ['TI-9001', hojeMais(14), false],
      ['TI-9000', hojeMais(20), false],
    ]);
    expect(resposta.corpo.emprestimos[0].equipamento).toEqual({
      id: itens['TI-9001'].id,
      patrimonio: 'TI-9001',
      nome: 'Equipamento de teste 1',
      categoria: 'cabo',
      imagemUrl: expect.stringContaining('/storage/v1/object/public/equipamentos/TI-9001.jpg'),
      fotografo: 'Teste',
    });

    await admin(`/rest/v1/emprestimos?id=eq.${a.corpo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ devolucao_prevista: hojeMais(-2) }),
    });
    const comAtraso = await api(pessoa.token, 'GET', '/emprestimos/meus');
    expect(comAtraso.corpo.emprestimos[0]).toMatchObject({
      devolucaoPrevista: hojeMais(-2),
      atrasado: true,
    });
  });

  it('CA-10: uma pessoa não vê os empréstimos da outra nem escreve sem passar pela regra', async () => {
    const a = await criarUsuario();
    const b = await criarUsuario();
    const criado = await api(a.token, 'POST', '/emprestimos', { equipamentoId: itens['TI-9000'].id });
    expect(criado.status).toBe(201);

    const meusB = await api(b.token, 'GET', '/emprestimos/meus');
    expect(meusB.corpo.emprestimos).toEqual([]);

    const diretoB = await comoPessoa(b.token, '/rest/v1/emprestimos?select=*');
    expect(diretoB.status).toBe(200);
    expect(await diretoB.json()).toEqual([]);

    const diretoA = await comoPessoa(a.token, '/rest/v1/emprestimos?select=id');
    expect(await diretoA.json()).toEqual([{ id: criado.corpo.id }]);

    const insercao = await comoPessoa(b.token, '/rest/v1/emprestimos', {
      method: 'POST',
      body: JSON.stringify({
        equipamento_id: itens['TI-9001'].id,
        usuario_id: b.id,
        devolucao_prevista: hojeMais(60),
      }),
    });
    expect(insercao.ok).toBe(false);

    const alteracao = await comoPessoa(b.token, `/rest/v1/emprestimos?id=eq.${criado.corpo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ usuario_id: b.id }),
    });
    expect(alteracao.ok).toBe(false);

    const liberarItem = await comoPessoa(b.token, `/rest/v1/equipamentos?id=eq.${itens['TI-9000'].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ situacao: 'disponivel' }),
    });
    expect(liberarItem.ok).toBe(false);

    expect(await emprestimosAbertos()).toHaveLength(1);
    const [linha] = await admin<LinhaEquipamento[]>(
      `/rest/v1/equipamentos?select=situacao&id=eq.${itens['TI-9000'].id}`,
    );
    expect(linha.situacao).toBe('emprestado');
  });
});
