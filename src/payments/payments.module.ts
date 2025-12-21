import { Module } from '@nestjs/common'
import { SettingsModule } from '@/settings/settings.module'
import { PrismaService } from '@/prisma.service'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'

@Module({
	imports: [SettingsModule],
	controllers: [PaymentsController],
	providers: [PaymentsService, PrismaService],
	exports: [PaymentsService]
})
export class PaymentsModule {}
