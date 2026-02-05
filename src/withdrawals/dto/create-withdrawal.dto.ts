import { IsIn, IsNumber, IsPositive } from 'class-validator'

const METHODS = ['CREDIT_CARD', 'PAYPAL', 'USDT_TRC20'] as const
export type WithdrawalMethodKey = (typeof METHODS)[number]

export class CreateWithdrawalDto {
	@IsNumber()
	@IsPositive()
	amount: number

	@IsIn(METHODS)
	method: WithdrawalMethodKey
}
