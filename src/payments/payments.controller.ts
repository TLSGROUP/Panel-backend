import { Body, Controller, Get, Headers, HttpCode, Post, Req, UsePipes, ValidationPipe } from '@nestjs/common'
import { Auth } from '@/auth/decorators/auth.decorator'
import { CurrentUser } from '@/auth/decorators/user.decorator'
import type { Request } from 'express'
import { PaymentsService } from './payments.service'
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto'
import { CancelPaymentDto } from './dto/cancel-payment.dto'

@Controller('payments')
export class PaymentsController {
	constructor(private readonly paymentsService: PaymentsService) {}

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
