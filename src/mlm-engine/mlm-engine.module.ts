import { Module } from '@nestjs/common'
import { SettingsModule } from '@/settings/settings.module'
import { PrismaService } from '@/prisma.service'
import { MlmEngineController } from './mlm-engine.controller'
import { MlmEngineService } from './mlm-engine.service'

@Module({
	imports: [SettingsModule],
	controllers: [MlmEngineController],
	providers: [MlmEngineService, PrismaService],
	exports: [MlmEngineService]
})
export class MlmEngineModule {}
