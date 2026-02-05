import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'
import { Prisma } from 'prisma/generated/client'
import {
	WalletTransactionType,
	WithdrawalMethod,
	WithdrawalStatus
} from 'prisma/generated/enums'
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto'
import { UpdateWithdrawalDto } from './dto/update-withdrawal.dto'
import { GetWithdrawalsDto } from './dto/get-withdrawals.dto'

@Injectable()
export class WithdrawalsService {
	constructor(private readonly prisma: PrismaService) {}

	private parseDate(value?: string | null, endOfDay = false) {
		if (!value) return null
		const iso = `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`
		const parsed = new Date(iso)
		return Number.isNaN(parsed.getTime()) ? null : parsed
	}

	private formatRequestId(sequence: number) {
		return `WR-${String(sequence).padStart(6, '0')}`
	}

	private resolveDetails(
		user: {
			payoutCreditCard?: string | null
			payoutPaypal?: string | null
			payoutUsdt?: string | null
		},
		method: WithdrawalMethod
	) {
		if (method === WithdrawalMethod.USDT_TRC20) {
			return user.payoutUsdt || null
		}
		if (method === WithdrawalMethod.PAYPAL) {
			return user.payoutPaypal || null
		}
		if (method === WithdrawalMethod.CREDIT_CARD) {
			return user.payoutCreditCard || null
		}
		return null
	}

	private formatMethod(method: WithdrawalMethod) {
		if (method === WithdrawalMethod.USDT_TRC20) return 'USDT (TRC20)'
		if (method === WithdrawalMethod.PAYPAL) return 'PayPal'
		return 'Credit card'
	}

	async createRequest(userId: string, dto: CreateWithdrawalDto) {
		const amountMinor = Math.round(dto.amount * 100)
		if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
			throw new BadRequestException('Invalid amount')
		}

		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				payoutCreditCard: true,
				payoutPaypal: true,
				payoutUsdt: true,
				wallet: {
					select: {
						balance: true,
						currency: true
					}
				}
			}
		})

		if (!user?.wallet?.currency) {
			throw new BadRequestException('Wallet not found')
		}

		if (amountMinor > user.wallet.balance) {
			throw new BadRequestException('Insufficient wallet balance')
		}

		const details = this.resolveDetails(user, dto.method as WithdrawalMethod)
		if (!details) {
			throw new BadRequestException('Withdrawal details are missing')
		}

		const created = await this.prisma.$transaction(async (tx) => {
			const request = await tx.withdrawalRequest.create({
				data: {
					userId: user.id,
					amount: amountMinor,
					currency: user.wallet!.currency,
					method: dto.method as WithdrawalMethod,
					details,
					status: WithdrawalStatus.PENDING,
					requestId: `WR-TMP-${Date.now()}-${Math.random()
						.toString(36)
						.slice(2, 8)}`
				},
				select: {
					id: true,
					sequence: true,
					userId: true,
					amount: true,
					currency: true,
					method: true,
					details: true,
					status: true,
					createdAt: true
				}
			})

			const requestId = this.formatRequestId(request.sequence)
			const updated = await tx.withdrawalRequest.update({
				where: { id: request.id },
				data: { requestId },
				select: {
					id: true,
					requestId: true,
					userId: true,
					amount: true,
					currency: true,
					method: true,
					details: true,
					status: true,
					createdAt: true
				}
			})

			return updated
		})

		return {
			...created,
			amount: created.amount / 100,
			method: this.formatMethod(created.method)
		}
	}

	async getRequests(params: GetWithdrawalsDto) {
		const page = Math.max(Number(params.page) || 1, 1)
		const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100)
		const skip = (page - 1) * limit

		const where: Prisma.WithdrawalRequestWhereInput = {}
		const search = params.search?.trim()
		if (search) {
			const contains = () => ({
				contains: search,
				mode: Prisma.QueryMode.insensitive
			})
			const searchUpper = search.toUpperCase()
			where.OR = [
				{ requestId: contains() },
				{ userId: contains() },
				{ user: { name: contains() } },
				{ user: { lastName: contains() } },
				{ user: { email: contains() } },
				...(searchUpper.includes('PAID')
					? [{ status: WithdrawalStatus.PAID }]
					: []),
				...(searchUpper.includes('REJECTED')
					? [{ status: WithdrawalStatus.REJECTED }]
					: []),
				...(searchUpper.includes('PENDING')
					? [{ status: WithdrawalStatus.PENDING }]
					: []),
				...(searchUpper.includes('USDT')
					? [{ method: WithdrawalMethod.USDT_TRC20 }]
					: []),
				...(searchUpper.includes('PAYPAL')
					? [{ method: WithdrawalMethod.PAYPAL }]
					: []),
				...(searchUpper.includes('CARD') || searchUpper.includes('CREDIT')
					? [{ method: WithdrawalMethod.CREDIT_CARD }]
					: [])
			]
		}
		const fromDate = this.parseDate(params.from_date, false)
		const toDate = this.parseDate(params.to_date, true)
		if (fromDate && toDate) {
			where.createdAt = { gte: fromDate, lte: toDate }
		} else if (fromDate) {
			where.createdAt = { gte: fromDate }
		} else if (toDate) {
			where.createdAt = { lte: toDate }
		}

		const allowedSortFields = [
			'requestId',
			'amount',
			'method',
			'status',
			'createdAt',
			'name',
			'lastName',
			'email'
		]
		const sortField = allowedSortFields.includes(params.sort_by ?? '')
			? (params.sort_by as string)
			: 'createdAt'
		const sortOrder = params.sort_order === 'asc' ? 'asc' : 'desc'

		const orderBy: Prisma.WithdrawalRequestOrderByWithRelationInput =
			sortField === 'name' || sortField === 'lastName' || sortField === 'email'
				? { user: { [sortField]: sortOrder } }
				: { [sortField]: sortOrder }

		const [items, totalItems] = await this.prisma.$transaction([
			this.prisma.withdrawalRequest.findMany({
				where,
				skip,
				take: limit,
				orderBy,
				select: {
					id: true,
					requestId: true,
					userId: true,
					amount: true,
					currency: true,
					method: true,
					details: true,
					status: true,
					txHash: true,
					receiptUrl: true,
					createdAt: true,
					user: {
						select: {
							name: true,
							lastName: true,
							email: true
						}
					}
				}
			}),
			this.prisma.withdrawalRequest.count({ where })
		])

		const data = items.map((item) => ({
			id: item.id,
			requestId: item.requestId,
			userId: item.userId,
			name: item.user?.name ?? '',
			lastName: item.user?.lastName ?? '',
			email: item.user?.email ?? '',
			amount: item.amount / 100,
			currency: item.currency,
			method: this.formatMethod(item.method),
			details: item.details,
			status: item.status,
			txHash: item.txHash,
			receiptUrl: item.receiptUrl,
			createdAt: item.createdAt
		}))

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

	async getUserRequests(userId: string, params: GetWithdrawalsDto) {
		const page = Math.max(Number(params.page) || 1, 1)
		const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100)
		const skip = (page - 1) * limit
		const where: Prisma.WithdrawalRequestWhereInput = { userId }
		const search = params.search?.trim()
		if (search) {
			const contains = () => ({
				contains: search,
				mode: Prisma.QueryMode.insensitive
			})
			const searchUpper = search.toUpperCase()
			where.OR = [
				{ requestId: contains() },
				...(searchUpper.includes('PAID')
					? [{ status: WithdrawalStatus.PAID }]
					: []),
				...(searchUpper.includes('REJECTED')
					? [{ status: WithdrawalStatus.REJECTED }]
					: []),
				...(searchUpper.includes('PENDING')
					? [{ status: WithdrawalStatus.PENDING }]
					: []),
				...(searchUpper.includes('USDT')
					? [{ method: WithdrawalMethod.USDT_TRC20 }]
					: []),
				...(searchUpper.includes('PAYPAL')
					? [{ method: WithdrawalMethod.PAYPAL }]
					: []),
				...(searchUpper.includes('CARD') || searchUpper.includes('CREDIT')
					? [{ method: WithdrawalMethod.CREDIT_CARD }]
					: [])
			]
		}
		const fromDate = this.parseDate(params.from_date, false)
		const toDate = this.parseDate(params.to_date, true)
		if (fromDate && toDate) {
			where.createdAt = { gte: fromDate, lte: toDate }
		} else if (fromDate) {
			where.createdAt = { gte: fromDate }
		} else if (toDate) {
			where.createdAt = { lte: toDate }
		}
		const sortBy = params.sort_by || 'createdAt'
		const sortOrder: Prisma.SortOrder =
			params.sort_order === 'asc' ? 'asc' : 'desc'
		const sortableFields = new Set([
			'requestId',
			'amount',
			'method',
			'status',
			'createdAt'
		])

		const orderBy: Prisma.WithdrawalRequestOrderByWithRelationInput =
			sortableFields.has(sortBy)
				? { [sortBy]: sortOrder }
				: { createdAt: 'desc' }

		const [items, totalItems] = await Promise.all([
			this.prisma.withdrawalRequest.findMany({
				where,
				orderBy,
				skip,
				take: limit,
				select: {
					id: true,
					requestId: true,
					userId: true,
					amount: true,
					currency: true,
					method: true,
					details: true,
					status: true,
					txHash: true,
					receiptUrl: true,
					createdAt: true
				}
			}),
			this.prisma.withdrawalRequest.count({ where })
		])

		const data = items.map((item) => ({
			id: item.id,
			requestId: item.requestId,
			userId: item.userId,
			amount: item.amount / 100,
			currency: item.currency,
			method: this.formatMethod(item.method),
			details: item.details,
			status: item.status,
			txHash: item.txHash,
			receiptUrl: item.receiptUrl,
			createdAt: item.createdAt
		}))

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

	async updateRequest(id: string, dto: UpdateWithdrawalDto) {
		if (
			dto.status === WithdrawalStatus.REJECTED &&
			(!dto.rejectReason || !dto.rejectReason.trim())
		) {
			throw new BadRequestException('Reject reason is required')
		}
		const updated = await this.prisma.$transaction(async (tx) => {
			const request = await tx.withdrawalRequest.findUnique({
				where: { id },
				select: {
					id: true,
					userId: true,
					amount: true,
					currency: true,
					status: true
				}
			})

			if (!request) {
				throw new BadRequestException('Withdrawal request not found')
			}

			if (
				request.status === WithdrawalStatus.PAID &&
				dto.status !== WithdrawalStatus.PAID
			) {
				throw new BadRequestException('Withdrawal request is already paid')
			}

			if (dto.status === WithdrawalStatus.PAID) {
				const wallet = await tx.wallet.findUnique({
					where: { userId: request.userId },
					select: { id: true, balance: true, currency: true }
				})

				if (!wallet) {
					throw new BadRequestException('Wallet not found')
				}

				if (wallet.balance < request.amount) {
					throw new BadRequestException('Insufficient wallet balance')
				}

				if (request.status !== WithdrawalStatus.PAID) {
					await tx.wallet.update({
						where: { id: wallet.id },
						data: { balance: { decrement: request.amount } }
					})

					await tx.walletTransaction.create({
						data: {
							walletId: wallet.id,
							type: WalletTransactionType.DEBIT,
							amount: request.amount,
							currency: wallet.currency
						}
					})
				}
			}

			return tx.withdrawalRequest.update({
				where: { id },
				data: {
					status: dto.status as WithdrawalStatus,
					txHash: dto.txHash?.trim() || null,
					receiptUrl: dto.receiptUrl?.trim() || null,
					rejectReason: dto.rejectReason?.trim() || null
				},
				select: {
					id: true,
					requestId: true,
					userId: true,
					amount: true,
					currency: true,
					method: true,
					details: true,
					status: true,
					txHash: true,
					receiptUrl: true,
					rejectReason: true,
					createdAt: true,
					updatedAt: true
				}
			})
		})

		return {
			...updated,
			amount: updated.amount / 100,
			method: this.formatMethod(updated.method)
		}
	}
}
