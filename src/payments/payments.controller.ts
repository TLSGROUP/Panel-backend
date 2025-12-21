import { Body, Controller, Get, Headers, HttpCode, Post, Req, Sse, UsePipes, ValidationPipe } from '@nestjs/common'
import { Auth } from '@/auth/decorators/auth.decorator'
import { CurrentUser } from '@/auth/decorators/user.decorator'
import type { Request } from 'express'
import { fromEvent, map } from 'rxjs'
import { PaymentsService } from './payments.service'
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto'
import { CancelPaymentDto } from './dto/cancel-payment.dto'
import { PlansEventsService } from '@/plans/plans-events.service'
import { CreatePayPalOrderDto } from './dto/create-paypal-order.dto'
import { CapturePayPalOrderDto } from './dto/capture-paypal-order.dto'
import { CancelPayPalOrderDto } from './dto/cancel-paypal-order.dto'

@Controller('payments')
export class PaymentsController {
	constructor(
		private readonly paymentsService: PaymentsService,
		private readonly plansEventsService: PlansEventsService
	) {}

	@Auth()
	@Get('plans')
	getPlans() {
		return this.paymentsService.getPlans()
	}

	@Auth()
	@Get('public-key')
	async getPublicKey() {
		return { publicKey: await this.paymentsService.getPublicKey() }
	}

	@Auth()
	@Get('paypal/client-id')
	async getPayPalClientId() {
		return { clientId: await this.paymentsService.getPayPalClientId() }
	}

	@Sse('plans/stream')
	streamPlansUpdates() {
		return fromEvent(this.plansEventsService.getEmitter(), 'plans-updated').pipe(
			map((payload) => ({ data: payload }))
		)
	}

	@Auth()
	@UsePipes(new ValidationPipe())
	@Post('intent')
	async createPaymentIntent(
		@CurrentUser('id') userId: string,
		@Body() dto: CreatePaymentIntentDto
	) {
		return this.paymentsService.createPaymentIntent(userId, dto.planId)
	}

	@Auth()
	@UsePipes(new ValidationPipe())
	@Post('paypal/order')
	async createPayPalOrder(
		@CurrentUser('id') userId: string,
		@Body() dto: CreatePayPalOrderDto
	) {
		return this.paymentsService.createPayPalOrder(userId, dto.planId)
	}

	@Auth()
	@UsePipes(new ValidationPipe())
	@Post('paypal/capture')
	async capturePayPalOrder(
		@CurrentUser('id') userId: string,
		@Body() dto: CapturePayPalOrderDto
	) {
		return this.paymentsService.capturePayPalOrder(userId, dto.orderId)
	}

	@Auth()
	@UsePipes(new ValidationPipe())
	@Post('paypal/cancel')
	async cancelPayPalOrder(
		@CurrentUser('id') userId: string,
		@Body() dto: CancelPayPalOrderDto
	) {
		return this.paymentsService.cancelPayPalOrder(userId, dto.orderId)
	}

	@Auth()
	@UsePipes(new ValidationPipe())
	@Post('cancel')
	async cancelPayment(
		@CurrentUser('id') userId: string,
		@Body() dto: CancelPaymentDto
	) {
		return this.paymentsService.cancelPayment(userId, dto.paymentId)
	}

	@Post('webhook')
	@HttpCode(200)
	async handleWebhook(
		@Headers('stripe-signature') signature: string | string[] | undefined,
		@Req() request: Request
	) {
		const payload = request.body as Buffer
		return this.paymentsService.handleWebhook(signature, payload)
	}
}
