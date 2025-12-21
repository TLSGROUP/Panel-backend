import { IsNotEmpty, IsString } from 'class-validator'

export class CancelPaymentDto {
	@IsString()
	@IsNotEmpty()
	paymentId: string
}
