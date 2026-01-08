import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'

@Injectable()
export class WalletService {
	constructor(private readonly prisma: PrismaService) {}

	async getWallet(userId: string) {
		const wallet = await this.prisma.wallet.findUnique({
			where: { userId }
		})

		if (!wallet) {
			return {
				balance: 0,
				currency: null
			}
		}

		return {
			balance: wallet.balance,
			currency: wallet.currency
		}
	}

	async getRecentTransactions(userId: string, limit = 20, page = 1) {
		const wallet = await this.prisma.wallet.findUnique({
			where: { userId }
		})
		if (!wallet) {
			return {
				items: [],
				total: 0,
				page,
				limit
			}
		}

		const safePage = Number.isFinite(page) && page > 0 ? page : 1
		const skip = (safePage - 1) * limit

		const total = await this.prisma.walletTransaction.count({
			where: { walletId: wallet.id }
		})
		const items = await this.prisma.walletTransaction.findMany({
			where: { walletId: wallet.id },
			orderBy: { createdAt: 'desc' },
			skip,
			take: limit,
			select: {
				id: true,
				type: true,
				amount: true,
				currency: true,
				createdAt: true,
				paymentId: true,
				payout: {
					select: {
						level: true,
						percent: true,
						planId: true,
						sourceUser: {
							select: {
								id: true,
								name: true,
								lastName: true,
								email: true
							}
						}
					}
				}
			}
		})

		return {
			items: items.map((item) => ({
				id: item.id,
				type: item.type,
				amount: item.amount,
				currency: item.currency,
				createdAt: item.createdAt,
				paymentId: item.paymentId,
				payout: item.payout
					? {
							level: item.payout.level,
							percent: item.payout.percent,
							planId: item.payout.planId,
							sourceUser: item.payout.sourceUser
						}
					: null
			})),
			total,
			page: safePage,
			limit
		}
	}
}
