import { Module } from '@nestjs/common'
import { SettingsModule } from '@/settings/settings.module'
import { PlansEventsModule } from '@/plans/plans-events.module'
import { PrismaService } from '@/prisma.service'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'

@Module({
	imports: [SettingsModule, PlansEventsModule],
	controllers: [PaymentsController],
	providers: [PaymentsService, PrismaService],
	exports: [PaymentsService]
})
export class PaymentsModule {}
