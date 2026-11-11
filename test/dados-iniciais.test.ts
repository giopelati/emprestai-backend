// Spec 002 — dados iniciais. Roda contra o Supabase local (rules/tests.md).
import { beforeAll, describe, expect, it } from '@jest/globals';
import { execSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  RAIZ,
  admin,
  comoPessoa,
  configAdmin,
  configLocal,
  creditosDeTeste,
  criarUsuario,
  dimensoes,
  entrar,
  importarDaRaiz,
  jpegSintetico,
  limparDados,
  tabelaExiste,
} from './apoio/supabase-local.js';
import type { EquipamentoTeste } from './apoio/supabase-local.js';

interface Equipamento {
  id: string;
  patrimonio: string;
  nome: string;
  categoria: string;
  situacao: string;
  imagem_path: string;
  foto_pexels_id: number;
  foto_fotografo: string;
  foto_fotografo_url: string;
  foto_pagina_url: string;
  foto_licenca: string;
}

const EMAIL_PROFESSOR = 'marcelo.grilo@institutojef.org.br';
const equipamentos: EquipamentoTeste[] = JSON.parse(
  readFileSync(join(RAIZ, 'supabase', 'dados', 'equipamentos.json'), 'utf8'),
);
const senhaProfessor = randomUUID();
const silencioso = () => undefined;
const imagemValida = async () => jpegSintetico(800, 600);

let popular: any;
let lib: any;
let enviar: any;

async function rodarPopular() {
  return popular.popular(configAdmin(), {
    senhaProfessor,
    equipamentos,
    creditos: creditosDeTeste(equipamentos),
    obterImagem: imagemValida,
    log: silencioso,
  });
}

async function lerEquipamentos(): Promise<Equipamento[]> {
  return admin<Equipamento[]>('/rest/v1/equipamentos?select=*&order=patrimonio.asc');
}

async function contasDoProfessor(): Promise<string[]> {
  const corpo = await admin<{ users: { id: string; email: string }[] }>(
    '/auth/v1/admin/users?page=1&per_page=1000',
  );
  return corpo.users.filter((u) => u.email === EMAIL_PROFESSOR).map((u) => u.id);
}

function papelDoToken(token: string): string | undefined {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  return payload?.app_metadata?.role;
}

describe('Spec 002 — dados iniciais', () => {
  beforeAll(async () => {
    popular = await importarDaRaiz('scripts/dados/popular.mjs');
    lib = await importarDaRaiz('skills/imagens-equipamentos/scripts/lib.mjs');
    enviar = await importarDaRaiz('skills/imagens-equipamentos/scripts/enviar.mjs');
    await limparDados();
    await rodarPopular();
  });

  it('CA-01: popula exatamente os 12 equipamentos da lista, com todos os campos', async () => {
    const linhas = await lerEquipamentos();
    expect(linhas.map((l) => l.patrimonio)).toEqual(equipamentos.map((e) => e.patrimonio));
    for (const linha of linhas) {
      const esperado = equipamentos.find((e) => e.patrimonio === linha.patrimonio)!;
      expect(linha.nome).toBe(esperado.nome);
      expect(linha.categoria).toBe(esperado.categoria);
      expect(linha.situacao).toBeTruthy();
      expect(linha.imagem_path).toBe(`${linha.patrimonio}.jpg`);
    }
    const porCategoria = linhas.reduce<Record<string, number>>((acc, l) => {
      acc[l.categoria] = (acc[l.categoria] ?? 0) + 1;
      return acc;
    }, {});
    expect(porCategoria).toEqual({ notebook: 4, monitor: 3, cabo: 3, camera: 2 });
  });

  it('CA-02: TI-0004, TI-0007 e TI-0010 em manutenção, 9 disponíveis e nenhum empréstimo', async () => {
    const linhas = await lerEquipamentos();
    const manutencao = linhas.filter((l) => l.situacao === 'manutencao').map((l) => l.patrimonio);
    expect(manutencao).toEqual(['TI-0004', 'TI-0007', 'TI-0010']);
    expect(linhas.filter((l) => l.situacao === 'disponivel')).toHaveLength(9);
    if (await tabelaExiste('emprestimos')) {
      expect(await admin<unknown[]>('/rest/v1/emprestimos?select=id')).toEqual([]);
    }
  });

  it('CA-03: cada imagem abre pela URL pública, sem login, em JPEG 800×600', async () => {
    const { url } = configLocal();
    for (const equipamento of equipamentos) {
      const resposta = await fetch(
        `${url}/storage/v1/object/public/equipamentos/${equipamento.patrimonio}.jpg`,
      );
      expect(resposta.status).toBe(200);
      expect(resposta.headers.get('content-type')).toContain('image/jpeg');
      expect(dimensoes(Buffer.from(await resposta.arrayBuffer()))).toEqual({
        largura: 800,
        altura: 600,
      });
    }
  });

  it('CA-03: arquivo fora de 800×600 é recusado antes do envio', async () => {
    await expect(
      enviar.enviarImagens(configAdmin(), {
        equipamentos,
        creditos: creditosDeTeste(equipamentos),
        obterImagem: async () => jpegSintetico(640, 480),
        log: silencioso,
      }),
    ).rejects.toThrow('640×480, esperado 800×600');
  });

  it('CA-04: origem fora de live.staticflickr.com é recusada', async () => {
    expect(() => lib.urlTamanho800('https://example.com/foto.jpg')).toThrow('Origem não permitida');
    expect(lib.urlTamanho800('https://live.staticflickr.com/27/49153471_90f62cf926_b.jpg')).toBe(
      'https://live.staticflickr.com/27/49153471_90f62cf926_c.jpg',
    );
    await expect(lib.baixarJpeg('https://example.com/foto.jpg')).rejects.toThrow(
      'Origem não permitida',
    );
  });

  it('CA-04: foto repetida é recusada pela skill e pelo banco', async () => {
    const creditos = creditosDeTeste(equipamentos);
    creditos[1].foto_id = creditos[0].foto_id;
    expect(() => enviar.validarCreditos(creditos, equipamentos)).toThrow('repetida');

    const [primeiro] = await lerEquipamentos();
    const { url, chaveSecreta } = configLocal();
    const resposta = await fetch(`${url}/rest/v1/equipamentos`, {
      method: 'POST',
      headers: {
        apikey: chaveSecreta,
        Authorization: `Bearer ${chaveSecreta}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patrimonio: 'TI-9999',
        nome: 'Duplicado',
        categoria: 'cabo',
        imagem_path: 'TI-9999.jpg',
        foto_pexels_id: primeiro.foto_pexels_id,
        foto_fotografo: 'x',
        foto_fotografo_url: 'x',
        foto_pagina_url: 'x',
        foto_licenca: 'x',
      }),
    });
    expect(resposta.status).toBe(409);
    expect(((await resposta.json()) as { code: string }).code).toBe('23505');
  });

  it('CA-04: imagem sem revisão humana registrada é recusada', () => {
    const creditos = creditosDeTeste(equipamentos).map((c) => ({ ...c, revisado_por: '' }));
    expect(() => enviar.validarCreditos(creditos, equipamentos)).toThrow(
      'sem registro de revisão humana',
    );
  });

  it('CA-05: cada equipamento registra id da foto, fotógrafo, URL do fotógrafo, página e licença', async () => {
    for (const linha of await lerEquipamentos()) {
      expect(linha.foto_pexels_id).toBeGreaterThan(0);
      expect(linha.foto_fotografo).not.toBe('');
      expect(linha.foto_fotografo_url).toMatch(/^https:\/\/www\.flickr\.com\//);
      expect(linha.foto_pagina_url).toMatch(/^https:\/\/www\.flickr\.com\/photos\//);
      expect(linha.foto_licenca).toMatch(/^(CC0|CC BY|Marca de Domínio Público)/);
    }
  });

  it('CA-05: só licenças CC0, domínio público ou CC BY são aceitas (C5)', () => {
    expect(lib.textoLicenca({ license: 'by', license_version: '2.0', license_url: 'https://creativecommons.org/licenses/by/2.0/' })).toBe(
      'CC BY 2.0 — https://creativecommons.org/licenses/by/2.0/',
    );
    for (const license of ['by-sa', 'by-nc', 'by-nd']) {
      expect(() => lib.textoLicenca({ license, license_url: 'x' })).toThrow('Licença não aceita');
    }
  });

  it('CA-06: rodar de novo não duplica nada e mantém a situação alterada', async () => {
    await admin('/rest/v1/equipamentos?patrimonio=eq.TI-0001', {
      method: 'PATCH',
      body: JSON.stringify({ situacao: 'emprestado' }),
    });
    const resultado = await rodarPopular();
    expect(resultado.criados).toBe(0);
    expect(resultado.atualizados).toBe(12);

    const linhas = await lerEquipamentos();
    expect(linhas).toHaveLength(12);
    expect(linhas.find((l) => l.patrimonio === 'TI-0001')?.situacao).toBe('emprestado');

    const objetos = await admin<unknown[]>('/storage/v1/object/list/equipamentos', {
      method: 'POST',
      body: JSON.stringify({ prefix: '', limit: 100 }),
    });
    expect(objetos).toHaveLength(12);
    expect(await contasDoProfessor()).toHaveLength(1);

    await admin('/rest/v1/equipamentos?patrimonio=eq.TI-0001', {
      method: 'PATCH',
      body: JSON.stringify({ situacao: 'disponivel' }),
    });
  });

  it('CA-07: o professor entra com a senha, tem papel colaborador e zero empréstimos', async () => {
    const token = await entrar(EMAIL_PROFESSOR, senhaProfessor);
    expect(papelDoToken(token)).toBe('colaborador');
    const [id] = await contasDoProfessor();
    if (await tabelaExiste('emprestimos')) {
      expect(await admin<unknown[]>(`/rest/v1/emprestimos?select=id&usuario_id=eq.${id}`)).toEqual(
        [],
      );
    }
  });

  it('CA-08: autenticado lê, mas não insere, altera nem apaga; anônimo não lê', async () => {
    const pessoa = await criarUsuario('colaborador');
    const antes = await lerEquipamentos();

    const leitura = await comoPessoa(pessoa.token, '/rest/v1/equipamentos?select=patrimonio');
    expect(leitura.status).toBe(200);
    expect((await leitura.json()) as unknown[]).toHaveLength(12);

    const insercao = await comoPessoa(pessoa.token, '/rest/v1/equipamentos', {
      method: 'POST',
      body: JSON.stringify({ patrimonio: 'TI-8888', nome: 'x', categoria: 'cabo' }),
    });
    expect(insercao.ok).toBe(false);
    const alteracao = await comoPessoa(pessoa.token, '/rest/v1/equipamentos?patrimonio=eq.TI-0002', {
      method: 'PATCH',
      body: JSON.stringify({ situacao: 'manutencao' }),
    });
    expect(alteracao.ok).toBe(false);
    const remocao = await comoPessoa(pessoa.token, '/rest/v1/equipamentos?patrimonio=eq.TI-0003', {
      method: 'DELETE',
    });
    expect(remocao.ok).toBe(false);
    expect(await lerEquipamentos()).toEqual(antes);

    const anonimo = await comoPessoa(null, '/rest/v1/equipamentos?select=patrimonio');
    expect(anonimo.ok).toBe(false);
  });

  it('CA-09: escrita em produção é recusada sem terminal interativo', () => {
    for (const script of ['scripts/dados/popular.mjs', 'skills/imagens-equipamentos/scripts/enviar.mjs']) {
      const execucao = spawnSync(process.execPath, [join(RAIZ, script), '--producao'], {
        cwd: RAIZ,
        input: '',
        encoding: 'utf8',
        env: {
          ...process.env,
          PRODUCAO_SUPABASE_URL: 'https://exemplo-producao.invalid',
          PRODUCAO_SUPABASE_SECRET_KEY: 'nao-e-uma-chave',
        },
      });
      expect(execucao.status).toBe(1);
      expect(execucao.stderr).toContain('exige uma pessoa no terminal (TTY)');
    }
  });

  it('CA-09: nenhum arquivo rastreado contém senha, chave ou token', () => {
    const arquivos = execSync('git ls-files', { cwd: RAIZ, encoding: 'utf8' })
      .split('\n')
      .filter((f) => f && !f.endsWith('package-lock.json') && !/\.(png|jpg|jpeg|ico)$/.test(f));
    expect(arquivos.some((f) => /(^|\/)\.env$/.test(f))).toBe(false);
    const padroes = [
      /sb_secret_[A-Za-z0-9_-]{10,}/,
      /sb_publishable_[A-Za-z0-9_-]{10,}/,
      /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}/,
      /PEXELS_API_KEY\s*=\s*\S{8,}/,
    ];
    const achados: string[] = [];
    for (const arquivo of arquivos) {
      const conteudo = readFileSync(join(RAIZ, arquivo), 'utf8');
      for (const padrao of padroes) {
        if (padrao.test(conteudo)) {
          achados.push(`${arquivo}: ${padrao}`);
        }
      }
    }
    expect(achados).toEqual([]);
  });
});
