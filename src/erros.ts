import { HttpException, HttpStatus } from '@nestjs/common';

// Mensagens da spec 003, tabela "Mensagens".
export const ERROS = {
  NAO_AUTENTICADO: {
    status: HttpStatus.UNAUTHORIZED,
    mensagem: 'Sua sessão expirou. Entre novamente.',
  },
  PAPEL_INVALIDO: {
    status: HttpStatus.FORBIDDEN,
    mensagem: 'Seu acesso ainda não foi configurado. Fale com Operações.',
  },
  ENTRADA_INVALIDA: {
    status: HttpStatus.BAD_REQUEST,
    mensagem: 'Informe um equipamento válido.',
  },
  EQUIPAMENTO_NAO_ENCONTRADO: {
    status: HttpStatus.NOT_FOUND,
    mensagem: 'Equipamento não encontrado.',
  },
  EQUIPAMENTO_INDISPONIVEL: {
    status: HttpStatus.CONFLICT,
    mensagem: 'Este equipamento não está disponível para empréstimo.',
  },
  EMPRESTIMO_EM_ATRASO: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    mensagem: 'Você tem empréstimo em atraso. Devolva o item atrasado para solicitar outro.',
  },
  LIMITE_DE_EMPRESTIMOS: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    mensagem: 'Você já está com 3 itens emprestados. Devolva um para solicitar outro.',
  },
  ERRO_INESPERADO: {
    status: HttpStatus.BAD_GATEWAY,
    mensagem: 'Não foi possível concluir agora. Tente novamente.',
  },
} as const;

export type CodigoErro = keyof typeof ERROS;

export function erro(codigo: CodigoErro): HttpException {
  const { status, mensagem } = ERROS[codigo];
  return new HttpException({ codigo, mensagem }, status);
}

interface ErroPostgrest {
  code?: string;
  message?: string;
}

// Traduz a resposta de erro do PostgREST para o contrato da API.
export function traduzirErroPostgrest(status: number, corpo: unknown): HttpException {
  const { code = '', message = '' } = (corpo ?? {}) as ErroPostgrest;

  if (status === 401 || code.startsWith('PGRST30')) {
    return erro('NAO_AUTENTICADO');
  }
  if (message in ERROS) {
    return erro(message as CodigoErro);
  }
  if (code === '23505') {
    // Índice único de empréstimo aberto por equipamento (CA-08).
    return erro('EQUIPAMENTO_INDISPONIVEL');
  }
  if (code === '22P02') {
    return erro('ENTRADA_INVALIDA');
  }
  return erro('ERRO_INESPERADO');
}
