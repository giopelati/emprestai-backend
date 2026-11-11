import { Controller, Get, Headers } from '@nestjs/common';

import { extrairToken } from '../auth/token.js';
import { EquipamentosService } from './equipamentos.service.js';
import type { Equipamento } from './equipamentos.service.js';

@Controller('equipamentos')
export class EquipamentosController {
  constructor(private readonly equipamentos: EquipamentosService) {}

  @Get()
  listar(@Headers('authorization') autorizacao?: string): Promise<Equipamento[]> {
    return this.equipamentos.listar(extrairToken(autorizacao));
  }
}
