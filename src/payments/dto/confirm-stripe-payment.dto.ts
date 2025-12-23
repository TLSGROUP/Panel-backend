import { IsNotEmpty, IsString } from 'class-validator'

export class ConfirmStripePaymentDto {
	@IsString()
	@IsNotEmpty()
	paymentId: string
}
