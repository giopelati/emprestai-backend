import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { extrairToken } from '../auth/token.js';
import { erro } from '../erros.js';
import { SolicitarEmprestimoSchema } from './emprestimos.schema.js';
import { EmprestimosService } from './emprestimos.service.js';
import type { EmprestimoCriado, MeusEmprestimos } from './emprestimos.service.js';

@Controller('emprestimos')
export class EmprestimosController {
  constructor(private readonly emprestimos: EmprestimosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  solicitar(
    @Headers('authorization') autorizacao: string | undefined,
    @Body() corpo: unknown,
  ): Promise<EmprestimoCriado> {
    const token = extrairToken(autorizacao);
    const entrada = SolicitarEmprestimoSchema.safeParse(corpo);
    if (!entrada.success) {
      throw erro('ENTRADA_INVALIDA');
    }
    return this.emprestimos.solicitar(token, entrada.data.equipamentoId);
  }

  @Get('meus')
  meus(@Headers('authorization') autorizacao?: string): Promise<MeusEmprestimos> {
    return this.emprestimos.meus(extrairToken(autorizacao));
  }
}
