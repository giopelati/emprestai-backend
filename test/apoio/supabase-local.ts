// Apoio dos testes: só fala com o Supabase LOCAL (rules/tests.md).
// URL e chaves vêm de `npx supabase status`; nenhum .env é lido.
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

export interface ConfigLocal {
  url: string;
  chavePublica: string;
  chaveSecreta: string;
}

let cache: ConfigLocal | null = null;

export function configLocal(): ConfigLocal {
  if (cache) {
    return cache;
  }
  const saida = execSync('npx supabase status -o json', {
    cwd: RAIZ,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const status = JSON.parse(saida.slice(saida.indexOf('{'))) as Record<string, string>;
  const url = status.API_URL ?? '';
  const { hostname } = new URL(url);
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
    throw new Error(`Testes só rodam contra o Supabase local. Recebido: ${hostname}`);
  }
  cache = {
    url,
    chavePublica: status.PUBLISHABLE_KEY || status.ANON_KEY || '',
    chaveSecreta: status.SECRET_KEY || status.SERVICE_ROLE_KEY || '',
  };
  return cache;
}

export function configAdmin() {
  const { url, chaveSecreta } = configLocal();
  return { alvo: 'local', url, chave: chaveSecreta };
}

export async function admin<T = unknown>(caminho: string, init: RequestInit = {}): Promise<T> {
  const { url, chaveSecreta } = configLocal();
  const resposta = await fetch(`${url}${caminho}`, {
    ...init,
    headers: {
      apikey: chaveSecreta,
      Authorization: `Bearer ${chaveSecreta}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const texto = await resposta.text();
  if (!resposta.ok) {
    throw new Error(`${init.method ?? 'GET'} ${caminho} → ${resposta.status} ${texto}`);
  }
  return (texto ? JSON.parse(texto) : null) as T;
}

export interface UsuarioTeste {
  id: string;
  email: string;
  senha: string;
  token: string;
}

export async function entrar(email: string, senha: string): Promise<string> {
  const { url, chavePublica } = configLocal();
  const resposta = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: chavePublica, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha }),
  });
  const corpo = (await resposta.json()) as { access_token?: string };
  if (!resposta.ok || !corpo.access_token) {
    throw new Error(`Login de teste falhou para ${email}: ${resposta.status}`);
  }
  return corpo.access_token;
}

export async function criarUsuario(papel: string | null = 'colaborador'): Promise<UsuarioTeste> {
  const email = `teste-${randomUUID()}@emprestai.test`;
  const senha = randomUUID();
  const criado = await admin<{ id: string }>('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: senha,
      email_confirm: true,
      app_metadata: papel ? { role: papel } : {},
    }),
  });
  return { id: criado.id, email, senha, token: await entrar(email, senha) };
}

// Chamada à API REST do Supabase como uma pessoa (RLS aplicado).
export async function comoPessoa(
  token: string | null,
  caminho: string,
  init: RequestInit = {},
): Promise<Response> {
  const { url, chavePublica } = configLocal();
  const headers: Record<string, string> = {
    apikey: chavePublica,
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${url}${caminho}`, { ...init, headers });
}

export async function tabelaExiste(tabela: string): Promise<boolean> {
  const { url, chaveSecreta } = configLocal();
  const resposta = await fetch(`${url}/rest/v1/${tabela}?select=*&limit=0`, {
    headers: { apikey: chaveSecreta, Authorization: `Bearer ${chaveSecreta}` },
  });
  return resposta.ok;
}

export async function limparDados(): Promise<void> {
  if (await tabelaExiste('emprestimos')) {
    await admin('/rest/v1/emprestimos?id=not.is.null', { method: 'DELETE' });
  }
  await admin('/rest/v1/equipamentos?id=not.is.null', { method: 'DELETE' });
}

// JPEG mínimo com marcador SOF0 nas dimensões pedidas. Só para testes locais:
// o Storage confere o tipo, e a skill confere o cabeçalho.
export function jpegSintetico(largura: number, altura: number): Buffer {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (altura >> 8) & 0xff, altura & 0xff,
    (largura >> 8) & 0xff, largura & 0xff,
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ]);
}

export function dimensoes(buffer: Buffer): { largura: number; altura: number } | null {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  let i = 2;
  while (i + 9 < buffer.length) {
    const marcador = buffer[i + 1];
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
      return { altura: buffer.readUInt16BE(i + 5), largura: buffer.readUInt16BE(i + 7) };
    }
    i += 2 + buffer.readUInt16BE(i + 2);
  }
  return null;
}

// Importa módulos .mjs da raiz (skill e scripts) sem tipá-los.
export async function importarDaRaiz(caminhoRelativo: string): Promise<any> {
  return import(pathToFileURL(join(RAIZ, caminhoRelativo)).href);
}

export interface EquipamentoTeste {
  patrimonio: string;
  nome: string;
  categoria: string;
  situacao: string;
  busca: string;
}

export function creditosDeTeste(equipamentos: EquipamentoTeste[], base = 900000) {
  return equipamentos.map((e, i) => ({
    patrimonio: e.patrimonio,
    pexels_id: base + i,
    fotografo: `Fotógrafo ${i}`,
    fotografo_url: `https://www.pexels.com/@teste-${i}`,
    pagina_url: `https://www.pexels.com/photo/${base + i}/`,
    download_url: `https://images.pexels.com/photos/${base + i}/pexels-photo-${base + i}.jpeg`,
    licenca: 'Licença Pexels — https://www.pexels.com/license/',
    revisado_por: 'teste automatizado',
    revisado_em: '2026-11-10T00:00:00.000Z',
  }));
}
