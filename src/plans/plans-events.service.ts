import { Injectable } from '@nestjs/common'
import { EventEmitter } from 'events'

@Injectable()
export class PlansEventsService {
	private readonly emitter = new EventEmitter()

	getEmitter() {
		return this.emitter
	}

	emitPlansUpdated() {
		this.emitter.emit('plans-updated', { updatedAt: Date.now() })
	}
}
