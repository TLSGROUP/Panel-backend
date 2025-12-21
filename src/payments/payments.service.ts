import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common'
import { SettingsService } from '@/settings/settings.service'
import { PrismaService } from '@/prisma.service'
import Stripe from 'stripe'

const SETTINGS_KEYS = {
	STRIPE_SECRET_KEY: 'stripe.secret_key',
	STRIPE_PUBLIC_KEY: 'stripe.public_key',
	STRIPE_WEBHOOK_SECRET: 'stripe.webhook_secret',
	PLAN_CATALOG: 'plans.catalog'
}

type PlanCatalogItem = {
	id: string
	name: string
	amount: number
	currency: string
	description?: string
	features?: string[]
}

const DEFAULT_PLANS: PlanCatalogItem[] = [
	{
		id: 'bronze',
		name: 'Bronze',
		amount: 1900,
		currency: 'EUR',
		description: 'Ideal for freelancers and mini teams.',
		features: ['1 project', 'Basic analytics', 'Email support']
	},
	{
		id: 'silver',
		name: 'Silver',
		amount: 4900,
		currency: 'EUR',
		description: 'For teams that grow steadily.',
		features: ['5 projects', 'Advanced analytics', 'Priority support']
	},
	{
		id: 'gold',
		name: 'Gold',
		amount: 9900,
		currency: 'EUR',
		description: 'Optimized for agencies and startups.',
		features: ['Unlimited projects', 'Automation tools', 'Account manager']
	},
	{
		id: 'brilliant',
		name: 'Brilliant',
		amount: 19900,
		currency: 'EUR',
		description: 'Complete toolkit for enterprises.',
		features: ['All Pro features', '99.9% SLA', 'Custom onboarding']
	}
]

@Injectable()
export class PaymentsService {
	constructor(
		private readonly settingsService: SettingsService,
		private readonly prisma: PrismaService
	) {}

	async getPlans(): Promise<PlanCatalogItem[]> {
		const setting = await this.settingsService.getSettingValue(
			SETTINGS_KEYS.PLAN_CATALOG
		)
		if (!setting) return DEFAULT_PLANS

		try {
			const parsed = JSON.parse(setting) as PlanCatalogItem[]
			if (!Array.isArray(parsed)) return DEFAULT_PLANS
			return parsed
		} catch {
			return DEFAULT_PLANS
		}
	}

	async getPublicKey(): Promise<string> {
		const setting = await this.settingsService.getSettingValue(
			SETTINGS_KEYS.STRIPE_PUBLIC_KEY
		)
		if (!setting) {
			throw new InternalServerErrorException('Stripe public key is not configured')
		}
		return setting
	}

	private async getStripeClient(): Promise<Stripe> {
		const setting = await this.settingsService.getSettingValue(
			SETTINGS_KEYS.STRIPE_SECRET_KEY
		)
		if (!setting) {
			throw new InternalServerErrorException('Stripe secret key is not configured')
		}

		return new Stripe(setting, {
		})
	}

	async createPaymentIntent(userId: string, planId: string) {
		await this.cleanupStalePayments()

		const plans = await this.getPlans()
		const plan = plans.find((item) => item.id === planId)
		if (!plan) {
			throw new BadRequestException('Unknown plan')
		}

		const stripe = await this.getStripeClient()

		const payment = await this.prisma.payment.create({
			data: {
				userId,
				planId: plan.id,
				planName: plan.name,
				amount: plan.amount,
				currency: plan.currency,
				status: 'PENDING'
			}
		})

		const intent = await stripe.paymentIntents.create({
			amount: plan.amount,
			currency: plan.currency.toLowerCase(),
			automatic_payment_methods: { enabled: true },
			metadata: {
				userId,
				planId: plan.id,
				paymentId: payment.id
			}
		})

		if (!intent.client_secret) {
			throw new InternalServerErrorException('Stripe client secret is missing')
		}

		await this.prisma.payment.update({
			where: { id: payment.id },
			data: { stripePaymentIntentId: intent.id }
		})

		return {
			clientSecret: intent.client_secret,
			paymentId: payment.id
		}
	}

	private async getWebhookSecret(): Promise<string> {
		const setting = await this.settingsService.getSettingValue(
			SETTINGS_KEYS.STRIPE_WEBHOOK_SECRET
		)
		if (!setting) {
			throw new InternalServerErrorException('Stripe webhook secret is not configured')
		}
		return setting
	}

	async handleWebhook(signature: string | string[] | undefined, payload: Buffer) {
		if (!signature || Array.isArray(signature)) {
			throw new BadRequestException('Missing Stripe signature')
		}

		const stripe = await this.getStripeClient()
		const webhookSecret = await this.getWebhookSecret()
		let event: Stripe.Event

		try {
			event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
		} catch (error) {
			throw new BadRequestException('Invalid Stripe signature')
		}

		if (event.type === 'payment_intent.succeeded') {
			const intent = event.data.object as Stripe.PaymentIntent
			await this.markPaymentSuccess(intent)
		}

		if (event.type === 'payment_intent.payment_failed') {
			const intent = event.data.object as Stripe.PaymentIntent
			await this.markPaymentStatus(intent.id, 'FAILED')
		}

		if (event.type === 'payment_intent.canceled') {
			const intent = event.data.object as Stripe.PaymentIntent
			await this.markPaymentStatus(intent.id, 'CANCELED')
		}

		return { received: true }
	}

	private async markPaymentStatus(
		paymentIntentId: string,
		status: 'FAILED' | 'CANCELED'
	) {
		await this.prisma.payment.updateMany({
			where: { stripePaymentIntentId: paymentIntentId },
			data: { status }
		})
	}

	private async markPaymentSuccess(intent: Stripe.PaymentIntent) {
		const paymentId = intent.metadata?.paymentId
		const planId = intent.metadata?.planId
		const userId = intent.metadata?.userId

		if (!paymentId || !planId || !userId) {
			return
		}

		const plan = (await this.getPlans()).find((item) => item.id === planId)
		if (!plan) {
			return
		}

		await this.prisma.payment.update({
			where: { id: paymentId },
			data: { status: 'SUCCEEDED' }
		})

		await this.prisma.user.update({
			where: { id: userId },
			data: {
				activePlanId: plan.id,
				activePlanName: plan.name,
				activePlanPrice: plan.amount,
				activePlanCurrency: plan.currency,
				activePlanPurchasedAt: new Date()
			}
		})
	}

	async cancelPayment(userId: string, paymentId: string) {
		const payment = await this.prisma.payment.findUnique({
			where: { id: paymentId }
		})

		if (!payment || payment.userId !== userId) {
			throw new BadRequestException('Payment not found')
		}

		if (payment.status !== 'PENDING') {
			return { status: payment.status }
		}

		if (payment.stripePaymentIntentId) {
			const stripe = await this.getStripeClient()
			try {
				await stripe.paymentIntents.cancel(payment.stripePaymentIntentId)
			} catch {
				// Ignore Stripe cancel errors, keep local state consistent
			}
		}

		const updated = await this.prisma.payment.update({
			where: { id: payment.id },
			data: { status: 'CANCELED' }
		})

		return { status: updated.status }
	}

	private async cleanupStalePayments() {
		const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
		const stalePayments = await this.prisma.payment.findMany({
			where: {
				status: 'PENDING',
				createdAt: { lt: cutoff }
			}
		})

		if (stalePayments.length === 0) return

		const stripe = await this.getStripeClient()

		for (const payment of stalePayments) {
			if (payment.stripePaymentIntentId) {
				try {
					await stripe.paymentIntents.cancel(payment.stripePaymentIntentId)
				} catch {
					// ignore and still mark as canceled
				}
			}
		}

		await this.prisma.payment.updateMany({
			where: {
				id: { in: stalePayments.map((payment) => payment.id) }
			},
			data: { status: 'CANCELED' }
		})
	}
}
