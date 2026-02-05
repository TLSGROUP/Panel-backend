import { IsIn, IsOptional, IsString } from 'class-validator'

const STATUSES = ['PENDING', 'REJECTED', 'PAID'] as const
export type WithdrawalStatusKey = (typeof STATUSES)[number]

export class UpdateWithdrawalDto {
	@IsIn(STATUSES)
	status: WithdrawalStatusKey

	@IsOptional()
	@IsString()
	txHash?: string

	@IsOptional()
	@IsString()
	receiptUrl?: string

	@IsOptional()
	@IsString()
	rejectReason?: string
}
