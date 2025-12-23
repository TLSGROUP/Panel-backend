import { Controller, Get, Query } from '@nestjs/common'
import { Auth } from '@/auth/decorators/auth.decorator'
import { CurrentUser } from '@/auth/decorators/user.decorator'
import { WalletService } from './wallet.service'

@Controller('wallet')
export class WalletController {
	constructor(private readonly walletService: WalletService) {}

	@Auth()
	@Get()
	async getWallet(@CurrentUser('id') userId: string) {
		return this.walletService.getWallet(userId)
	}

	@Auth()
	@Get('transactions')
	async getTransactions(
		@CurrentUser('id') userId: string,
		@Query('limit') limit?: string
	) {
		const parsedLimit = limit ? Number.parseInt(limit, 10) : 20
		const safeLimit = Number.isNaN(parsedLimit)
			? 20
			: Math.min(Math.max(parsedLimit, 1), 100)
		return this.walletService.getRecentTransactions(userId, safeLimit)
	}
}
