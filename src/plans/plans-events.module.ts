import { Module } from '@nestjs/common'
import { PlansEventsService } from './plans-events.service'

@Module({
	providers: [PlansEventsService],
	exports: [PlansEventsService],
})
export class PlansEventsModule {}
