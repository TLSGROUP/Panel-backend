import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Auth } from '@/auth/decorators/auth.decorator'
import { CurrentUser } from '@/auth/decorators/user.decorator'
import { Role } from 'prisma/generated/enums'
import { WithdrawalsService } from './withdrawals.service'
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto'
import { UpdateWithdrawalDto } from './dto/update-withdrawal.dto'
import { GetWithdrawalsDto } from './dto/get-withdrawals.dto'

@Controller('withdrawals')
export class WithdrawalsController {
	constructor(private readonly withdrawalsService: WithdrawalsService) {}

	@Auth()
	@Post()
	async createRequest(
		@CurrentUser('id') userId: string,
		@Body() dto: CreateWithdrawalDto
	) {
		return this.withdrawalsService.createRequest(userId, dto)
	}

	@Auth([Role.ADMIN, Role.MANAGER])
	@Get()
	async getRequests(@Query() query: GetWithdrawalsDto) {
		return this.withdrawalsService.getRequests(query)
	}

	@Auth()
	@Get('me')
	async getMyRequests(
		@CurrentUser('id') userId: string,
		@Query() query: GetWithdrawalsDto
	) {
		return this.withdrawalsService.getUserRequests(userId, query)
	}

	@Auth([Role.ADMIN, Role.MANAGER])
	@Patch(':id')
	async updateRequest(@Param('id') id: string, @Body() dto: UpdateWithdrawalDto) {
		return this.withdrawalsService.updateRequest(id, dto)
	}
}
