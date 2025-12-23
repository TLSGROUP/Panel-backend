import { BadRequestException, Injectable } from '@nestjs/common'
import { SettingsService } from '@/settings/settings.service'
import { PrismaService } from '@/prisma.service'
import { MLM_MODULES } from './mlm-engine.registry'
import type { MlmModuleDefinition, MlmSettingValue } from './mlm-engine.types'

const SETTINGS_KEYS = {
	SETTINGS_PREFIX: 'mlm.settings.'
}

@Injectable()
export class MlmEngineService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly settingsService: SettingsService
	) {}

	private getModuleMap() {
		return new Map(MLM_MODULES.map((module) => [module.key, module]))
	}

	private async getEnabledKeys(): Promise<string[]> {
		const envValue = process.env.MLM_ENABLED
		if (!envValue) return []
		return envValue
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean)
	}

	private async getModuleSettings(module: MlmModuleDefinition) {
		const persisted = await this.prisma.mlmEngineSetting.findUnique({
			where: { moduleKey: module.key }
		})

		if (persisted?.settings && typeof persisted.settings === 'object') {
			return {
				...module.defaultSettings,
				...(persisted.settings as Record<string, MlmSettingValue>)
			}
		}

		const legacyStored = await this.settingsService.getSettingValue(
			`${SETTINGS_KEYS.SETTINGS_PREFIX}${module.key}`
		)
		if (!legacyStored) return module.defaultSettings

		try {
			const parsed = JSON.parse(legacyStored) as Record<string, MlmSettingValue>
			await this.prisma.mlmEngineSetting.upsert({
				where: { moduleKey: module.key },
				create: { moduleKey: module.key, settings: parsed },
				update: { settings: parsed }
			})
			return { ...module.defaultSettings, ...parsed }
		} catch {
			return module.defaultSettings
		}
	}

	private validateUnilevelSettings(settings: Record<string, MlmSettingValue>) {
		const planLevels = settings.planLevels
		if (planLevels === undefined) return

		if (!planLevels || typeof planLevels !== 'object' || Array.isArray(planLevels)) {
			throw new BadRequestException('planLevels must be an object')
		}

		Object.entries(planLevels as Record<string, MlmSettingValue>).forEach(
			([planId, levels]) => {
				if (!Array.isArray(levels) || levels.length === 0) {
					throw new BadRequestException(
						`planLevels for plan ${planId} must be a non-empty array`
					)
				}
				const invalidValue = (levels as MlmSettingValue[]).find(
					(level) =>
						typeof level !== 'number' ||
						Number.isNaN(level) ||
						level < 0 ||
						level > 100
				)
				if (invalidValue !== undefined) {
					throw new BadRequestException(
						`planLevels for plan ${planId} must be numbers between 0 and 100`
					)
				}
			}
		)
	}

	private getPlanLevels(
		settings: Record<string, MlmSettingValue>,
		planId: string
	): number[] {
		const planLevels = settings.planLevels
		if (!planLevels || typeof planLevels !== 'object' || Array.isArray(planLevels)) {
			return []
		}
		const levels = (planLevels as Record<string, MlmSettingValue>)[planId]
		if (!Array.isArray(levels)) return []
		if (!levels.every((level) => typeof level === 'number')) return []
		return levels as number[]
	}

	private async creditWalletForPayout(params: {
		payoutId: string
		receiverId: string
		amount: number
		currency: string
		paymentId: string
	}) {
		await this.prisma.$transaction(async (tx) => {
			const wallet = await tx.wallet.upsert({
				where: { userId: params.receiverId },
				create: {
					userId: params.receiverId,
					balance: 0,
					currency: params.currency
				},
				update: {}
			})

			if (wallet.currency !== params.currency) {
				throw new BadRequestException('Wallet currency mismatch')
			}

			const existing = await tx.walletTransaction.findUnique({
				where: { payoutId: params.payoutId }
			})
			if (existing) return

			await tx.walletTransaction.create({
				data: {
					walletId: wallet.id,
					type: 'CREDIT',
					amount: params.amount,
					currency: params.currency,
					payoutId: params.payoutId,
					paymentId: params.paymentId
				}
			})

			await tx.wallet.update({
				where: { id: wallet.id },
				data: { balance: { increment: params.amount } }
			})
		})
	}

	async getAvailableModules(): Promise<
		{
			key: string
			label: string
				description?: string
				fields: MlmModuleDefinition['schema']
				settings: Record<string, MlmSettingValue>
			}[]
	> {
		const enabled = new Set(await this.getEnabledKeys())
		const activeModules = MLM_MODULES.filter((module) => enabled.has(module.key))

		return Promise.all(
			activeModules.map(async (module) => ({
				key: module.key,
				label: module.label,
				description: module.description,
				fields: module.schema,
				settings: await this.getModuleSettings(module)
			}))
		)
	}

	async saveModuleSettings(key: string, settings: Record<string, MlmSettingValue>) {
		const moduleMap = this.getModuleMap()
		const module = moduleMap.get(key)
		if (!module) {
			throw new Error('Unknown MLM module')
		}
		if (key === 'unilevel') {
			this.validateUnilevelSettings(settings)
		}

		return this.prisma.mlmEngineSetting.upsert({
			where: { moduleKey: key },
			create: { moduleKey: key, settings },
			update: { settings }
		})
	}

	async createUnilevelPayouts(params: {
		paymentId: string
		buyerId: string
		amount: number
		currency: string
	}) {
		const enabled = new Set(await this.getEnabledKeys())
		if (!enabled.has('unilevel')) return

		const module = this.getModuleMap().get('unilevel')
		if (!module) return

		const settings = await this.getModuleSettings(module)
		const planLevels = settings.planLevels
		let maxDepth = 0
		if (planLevels && typeof planLevels === 'object' && !Array.isArray(planLevels)) {
			for (const value of Object.values(
				planLevels as Record<string, MlmSettingValue>
			)) {
				if (!Array.isArray(value)) continue
				const length = value.filter((level) => typeof level === 'number').length
				if (length > maxDepth) {
					maxDepth = length
				}
			}
		}
		if (maxDepth === 0) return

		const chain: { referrerId: string; planId: string }[] = []
		let currentUserId = params.buyerId
		for (let level = 0; level < maxDepth; level += 1) {
			const current = await this.prisma.user.findUnique({
				where: { id: currentUserId },
				select: { referrerId: true }
			})
			if (!current?.referrerId) break

			const referrer = await this.prisma.user.findUnique({
				where: { id: current.referrerId },
				select: { activePlanId: true }
			})
			if (!referrer?.activePlanId) {
				return
			}

			chain.push({ referrerId: current.referrerId, planId: referrer.activePlanId })
			currentUserId = current.referrerId
		}

		const payouts: {
			paymentId: string
			receiverId: string
			sourceUserId: string
			planId: string
			level: number
			percent: number
			amount: number
			currency: string
			moduleKey: string
		}[] = []

		for (let index = 0; index < chain.length; index += 1) {
			const { referrerId, planId } = chain[index]
			const levels = this.getPlanLevels(settings, planId)
			if (levels.length === 0 || index >= levels.length) {
				continue
			}

			const percent = levels[index]
			if (percent > 0) {
				const payoutAmount = Math.round((params.amount * percent) / 100)
				if (payoutAmount > 0) {
					payouts.push({
						paymentId: params.paymentId,
						receiverId: referrerId,
						sourceUserId: params.buyerId,
						planId,
						level: index + 1,
						percent,
						amount: payoutAmount,
						currency: params.currency,
						moduleKey: 'unilevel'
					})
				}
			}
		}

		if (payouts.length === 0) return

		for (const payout of payouts) {
			const existing = await this.prisma.mlmPayout.findUnique({
				where: {
					payment_receiver_level: {
						paymentId: payout.paymentId,
						receiverId: payout.receiverId,
						level: payout.level
					}
				}
			})
			if (existing) continue

			const created = await this.prisma.mlmPayout.create({ data: payout })
			await this.creditWalletForPayout({
				payoutId: created.id,
				receiverId: created.receiverId,
				amount: created.amount,
				currency: created.currency,
				paymentId: created.paymentId
			})
		}
	}
}
