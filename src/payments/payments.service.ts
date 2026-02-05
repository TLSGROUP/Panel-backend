import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common'
import { SettingsService } from '@/settings/settings.service'
import { PrismaService } from '@/prisma.service'
import Stripe from 'stripe'
import { MlmEngineService } from '@/mlm-engine/mlm-engine.service'
import { Prisma } from 'prisma/generated/client'
import { PaymentProvider, PaymentStatus } from 'prisma/generated/enums'
import { GetBillingHistoryDto } from './dto/get-billing-history.dto'

const SETTINGS_KEYS = {
	STRIPE_SECRET_KEY: 'stripe.secret_key',
	STRIPE_PUBLIC_KEY: 'stripe.public_key',
	STRIPE_WEBHOOK_SECRET: 'stripe.webhook_secret',
	PLAN_CATALOG: 'plans.catalog',
	PLAN_CURRENCY: 'plans.currency',
	PLAN_COLORS: 'plans.colors',
	PAYPAL_CLIENT_ID: 'paypal.client_id',
	PAYPAL_SECRET: 'paypal.secret',
	PAYPAL_MODE: 'paypal.mode'
}

type PlanCatalogItem = {
	id: string
	name: string
	amount: number
	currency: string
	description?: string
	features?: string[]
	color?: string
}

type BillingHistoryItem = {
	id: string
	type: 'Payment' | 'Payout'
	amount: number
	currency: string
	plan: string
	status: string
	source: string
	createdAt: Date
}

@Injectable()
export class PaymentsService {
	constructor(
		private readonly settingsService: SettingsService,
		private readonly prisma: PrismaService,
		private readonly mlmEngineService: MlmEngineService
	) {}

	async getPlans(): Promise<PlanCatalogItem[]> {
		const [catalogSetting, currencySetting, colorsSetting] = await Promise.all([
			this.settingsService.getSettingValue(SETTINGS_KEYS.PLAN_CATALOG),
			this.settingsService.getSettingValue(SETTINGS_KEYS.PLAN_CURRENCY),
			this.settingsService.getSettingValue(SETTINGS_KEYS.PLAN_COLORS)
		])

		let plans: PlanCatalogItem[] = []
		try {
			if (catalogSetting) {
				const parsed = JSON.parse(catalogSetting) as PlanCatalogItem[]
				if (Array.isArray(parsed)) {
					plans = parsed
				}
			}
		} catch {
			plans = []
		}

		if (plans.length === 0) return []

		const normalizedCurrency = currencySetting?.trim() || plans[0]?.currency || 'EUR'

		let colorMap: Record<string, string> = {}
		try {
			if (colorsSetting) {
				const parsed = JSON.parse(colorsSetting) as Record<string, string>
				if (parsed && typeof parsed === 'object') {
					colorMap = parsed
				}
			}
		} catch {
			colorMap = {}
		}

		return plans.map((plan) => ({
			...plan,
			currency: normalizedCurrency,
			color: colorMap[plan.id]
		}))
	}

	private formatPaymentStatus(status: PaymentStatus) {
		if (status === 'SUCCEEDED') return 'PAID'
		return status
	}

	private parseDate(value?: string | null, endOfDay = false) {
		if (!value) return null
		const iso = `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`
		const parsed = new Date(iso)
		return Number.isNaN(parsed.getTime()) ? null : parsed
	}

	async getBillingHistory(userId: string, params: GetBillingHistoryDto) {
		const page = Math.max(Number(params.page) || 1, 1)
		const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100)
		const take = page * limit
		const search = params.search?.trim()
		const fromDate = this.parseDate(params.from_date, false)
		const toDate = this.parseDate(params.to_date, true)
		const hasValidFrom = Boolean(fromDate)
		const hasValidTo = Boolean(toDate)
		const dateFilter =
			hasValidFrom && hasValidTo
				? { gte: fromDate as Date, lte: toDate as Date }
				: hasValidFrom
					? { gte: fromDate as Date }
					: hasValidTo
						? { lte: toDate as Date }
						: undefined

		const searchUpper = search?.toUpperCase()
		const paymentStatusMatch = searchUpper?.includes('PAID')
			? PaymentStatus.SUCCEEDED
			: searchUpper?.includes('PENDING')
				? PaymentStatus.PENDING
				: searchUpper?.includes('FAILED')
					? PaymentStatus.FAILED
					: searchUpper?.includes('CANCELED')
						? PaymentStatus.CANCELED
						: null

		const paymentProviderMatch = searchUpper?.includes('PAYPAL')
			? PaymentProvider.PAYPAL
			: searchUpper?.includes('STRIPE') ||
				searchUpper?.includes('CARD') ||
				searchUpper?.includes('CREDIT')
				? PaymentProvider.STRIPE
				: null

		const paymentWhere: Prisma.PaymentWhereInput = {
			userId,
			...(dateFilter ? { createdAt: dateFilter } : {}),
			...(search
				? {
						OR: [
							{
								planName: {
									contains: search,
									mode: Prisma.QueryMode.insensitive
								}
							},
							...(paymentStatusMatch ? [{ status: paymentStatusMatch }] : []),
							...(paymentProviderMatch ? [{ provider: paymentProviderMatch }] : [])
						]
					}
				: {})
		}

		const payoutWhere: Prisma.MlmPayoutWhereInput = {
			receiverId: userId,
			...(dateFilter ? { createdAt: dateFilter } : {}),
			...(search
				? {
						OR: [
							{
								payment: {
									planName: {
										contains: search,
										mode: Prisma.QueryMode.insensitive
									}
								}
							},
							{
								sourceUser: {
									name: {
										contains: search,
										mode: Prisma.QueryMode.insensitive
									}
								}
							},
							{
								sourceUser: {
									lastName: {
										contains: search,
										mode: Prisma.QueryMode.insensitive
									}
								}
							},
							{
								sourceUser: {
									email: {
										contains: search,
										mode: Prisma.QueryMode.insensitive
									}
								}
							}
						]
					}
				: {})
		}

		const [payments, payouts, paymentsCount, payoutsCount] = await Promise.all([
			this.prisma.payment.findMany({
				where: paymentWhere,
				orderBy: { createdAt: 'desc' },
				take,
				select: {
					id: true,
					planName: true,
					amount: true,
					currency: true,
					status: true,
					provider: true,
					createdAt: true
				}
			}),
			this.prisma.mlmPayout.findMany({
				where: payoutWhere,
				orderBy: { createdAt: 'desc' },
				take,
				select: {
					id: true,
					amount: true,
					currency: true,
					level: true,
					percent: true,
					createdAt: true,
					planId: true,
					payment: { select: { planName: true } },
					sourceUser: {
						select: { id: true, name: true, lastName: true, email: true }
					}
				}
			}),
			this.prisma.payment.count({ where: paymentWhere }),
			this.prisma.mlmPayout.count({ where: payoutWhere })
		])

		const paymentItems: BillingHistoryItem[] = payments.map((payment) => ({
			id: payment.id,
			type: 'Payment',
			amount: payment.amount / 100,
			currency: payment.currency,
			plan: payment.planName,
			status: this.formatPaymentStatus(payment.status),
			source: payment.provider === 'STRIPE' ? 'Credit Card' : 'PayPal',
			createdAt: payment.createdAt
		}))

		const payoutItems: BillingHistoryItem[] = payouts.map((payout) => {
			const sourceName = [payout.sourceUser?.name, payout.sourceUser?.lastName]
				.filter(Boolean)
				.join(' ')
			const source =
				sourceName.trim() ||
				payout.sourceUser?.email ||
				payout.sourceUser?.id ||
				'—'
			return {
				id: payout.id,
				type: 'Payout',
				amount: payout.amount / 100,
				currency: payout.currency,
				plan: payout.payment?.planName || payout.planId,
				status: 'PAID',
				source,
				createdAt: payout.createdAt
			}
		})

		const sortBy = params.sort_by || 'createdAt'
		const sortOrder = params.sort_order === 'asc' ? 1 : -1
		const merged = [...paymentItems, ...payoutItems].sort((a, b) => {
			if (sortBy === 'amount') {
				return (a.amount - b.amount) * sortOrder
			}
			return (a.createdAt.getTime() - b.createdAt.getTime()) * sortOrder
		})
		const start = (page - 1) * limit
		const data = merged.slice(start, start + limit)
		const totalItems = paymentsCount + payoutsCount

		return {
			success: true,
			data,
			pagination: {
				page,
				limit,
				total_pages: Math.max(1, Math.ceil(totalItems / limit)),
				total_items: totalItems
			}
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

	async getPayPalClientId(): Promise<string> {
		const setting = await this.settingsService.getSettingValue(
			SETTINGS_KEYS.PAYPAL_CLIENT_ID
		)
		if (!setting) {
			throw new InternalServerErrorException('PayPal client id is not configured')
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
				status: 'PENDING',
				provider: 'STRIPE'
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

	private async getPayPalConfig() {
		const [clientId, secret, mode] = await Promise.all([
			this.settingsService.getSettingValue(SETTINGS_KEYS.PAYPAL_CLIENT_ID),
			this.settingsService.getSettingValue(SETTINGS_KEYS.PAYPAL_SECRET),
			this.settingsService.getSettingValue(SETTINGS_KEYS.PAYPAL_MODE)
		])

		if (!clientId || !secret) {
			throw new InternalServerErrorException('PayPal credentials are not configured')
		}

		const environment = mode?.toLowerCase() === 'live' ? 'live' : 'sandbox'
		const baseUrl =
			environment === 'live'
				? 'https://api-m.paypal.com'
				: 'https://api-m.sandbox.paypal.com'

		return { clientId, secret, baseUrl }
	}

	private async getPayPalAccessToken() {
		const { clientId, secret, baseUrl } = await this.getPayPalConfig()
		const auth = Buffer.from(`${clientId}:${secret}`).toString('base64')

		const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${auth}`,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: 'grant_type=client_credentials'
		})

		if (!response.ok) {
			throw new InternalServerErrorException('PayPal auth failed')
		}

		const data = (await response.json()) as { access_token?: string }
		if (!data.access_token) {
			throw new InternalServerErrorException('PayPal access token missing')
		}

		return { accessToken: data.access_token, baseUrl }
	}

	async createPayPalOrder(userId: string, planId: string) {
		const plans = await this.getPlans()
		const plan = plans.find((item) => item.id === planId)
		if (!plan) {
			throw new BadRequestException('Unknown plan')
		}

		const payment = await this.prisma.payment.create({
			data: {
				userId,
				planId: plan.id,
				planName: plan.name,
				amount: plan.amount,
				currency: plan.currency,
				status: 'PENDING',
				provider: 'PAYPAL'
			}
		})

		try {
			const { accessToken, baseUrl } = await this.getPayPalAccessToken()
			const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					intent: 'CAPTURE',
					purchase_units: [
						{
							custom_id: payment.id,
							amount: {
								currency_code: plan.currency,
								value: (plan.amount / 100).toFixed(2)
							},
							description: plan.name
						}
					]
				})
			})

			if (!response.ok) {
				throw new Error('PayPal order creation failed')
			}

			const data = (await response.json()) as { id?: string }
			if (!data.id) {
				throw new Error('PayPal order id missing')
			}

			await this.prisma.payment.update({
				where: { id: payment.id },
				data: { paypalOrderId: data.id }
			})

			return { orderId: data.id }
		} catch (error) {
			await this.prisma.payment.update({
				where: { id: payment.id },
				data: { status: 'FAILED' }
			})
			throw new InternalServerErrorException('PayPal order creation failed')
		}
	}

	async capturePayPalOrder(userId: string, orderId: string) {
		const payment = await this.prisma.payment.findUnique({
			where: { paypalOrderId: orderId }
		})

		if (!payment || payment.userId !== userId) {
			throw new BadRequestException('Payment not found')
		}

		if (payment.status === 'SUCCEEDED') {
			return { status: payment.status }
		}

		const { accessToken, baseUrl } = await this.getPayPalAccessToken()
		const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			}
		})

		if (!response.ok) {
			await this.prisma.payment.update({
				where: { id: payment.id },
				data: { status: 'FAILED' }
			})
			throw new InternalServerErrorException('PayPal capture failed')
		}

		const data = (await response.json()) as { status?: string }
		if (data.status !== 'COMPLETED') {
			await this.prisma.payment.update({
				where: { id: payment.id },
				data: { status: 'FAILED' }
			})
			throw new InternalServerErrorException('PayPal capture incomplete')
		}

		await this.prisma.payment.update({
			where: { id: payment.id },
			data: { status: 'SUCCEEDED' }
		})

		await this.handleSuccessfulPayment(payment)

		return { status: 'SUCCEEDED' }
	}

	async cancelPayPalOrder(userId: string, orderId: string) {
		const payment = await this.prisma.payment.findUnique({
			where: { paypalOrderId: orderId }
		})

		if (!payment || payment.userId !== userId) {
			throw new BadRequestException('Payment not found')
		}

		if (payment.status !== 'PENDING') {
			return { status: payment.status }
		}

		try {
			const { accessToken, baseUrl } = await this.getPayPalAccessToken()
			await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/void`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				}
			})
		} catch {
			// ignore PayPal void errors
		}

		const updated = await this.prisma.payment.update({
			where: { id: payment.id },
			data: { status: 'CANCELED' }
		})

		return { status: updated.status }
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

		const payment = await this.prisma.payment.update({
			where: { id: paymentId },
			data: { status: 'SUCCEEDED' }
		})

		await this.handleSuccessfulPayment(payment)
	}

	private async applyPlanToUser(userId: string, planId: string) {
		const plan = (await this.getPlans()).find((item) => item.id === planId)
		if (!plan) {
			return
		}

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

	private async handleSuccessfulPayment(payment: {
		id: string
		userId: string
		planId: string
		amount: number
		currency: string
	}) {
		await this.applyPlanToUser(payment.userId, payment.planId)
		await this.mlmEngineService.createUnilevelPayouts({
			paymentId: payment.id,
			buyerId: payment.userId,
			amount: payment.amount,
			currency: payment.currency
		})
		await this.mlmEngineService.recordBinaryVolume({
			buyerId: payment.userId,
			binaryVolume: payment.amount
		})
	}

	async confirmStripePayment(userId: string, paymentId: string) {
		const payment = await this.prisma.payment.findUnique({
			where: { id: paymentId }
		})

		if (!payment || payment.userId !== userId) {
			throw new BadRequestException('Payment not found')
		}

		if (!payment.stripePaymentIntentId) {
			throw new BadRequestException('Stripe payment intent missing')
		}

		if (payment.status === 'SUCCEEDED') {
			return { status: payment.status }
		}

		const stripe = await this.getStripeClient()
		const intent = await stripe.paymentIntents.retrieve(
			payment.stripePaymentIntentId
		)

		if (intent.status !== 'succeeded') {
			return { status: intent.status }
		}

		await this.prisma.payment.update({
			where: { id: payment.id },
			data: { status: 'SUCCEEDED' }
		})

		await this.handleSuccessfulPayment(payment)

		return { status: 'SUCCEEDED' }
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
