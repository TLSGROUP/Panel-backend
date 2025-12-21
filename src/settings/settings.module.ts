import { Module } from '@nestjs/common'

import { PlansEventsModule } from '@/plans/plans-events.module'
import { PrismaService } from 'src/prisma.service'
import { SettingsController } from './settings.controller'
import { SettingsService } from './settings.service'

@Module({
	imports: [PlansEventsModule],
	controllers: [SettingsController],
	providers: [SettingsService, PrismaService],
	exports: [SettingsService],
})
export class SettingsModule {}
