import { Module } from '@nestjs/common';

import { EmprestimosController } from './emprestimos/emprestimos.controller.js';
import { EmprestimosService } from './emprestimos/emprestimos.service.js';
import { EquipamentosController } from './equipamentos/equipamentos.controller.js';
import { EquipamentosService } from './equipamentos/equipamentos.service.js';
import { HealthController } from './health/health.controller.js';
import { SupabaseRestService } from './supabase/supabase-rest.service.js';

@Module({
  controllers: [HealthController, EquipamentosController, EmprestimosController],
  providers: [SupabaseRestService, EquipamentosService, EmprestimosService],
})
export class AppModule {}
