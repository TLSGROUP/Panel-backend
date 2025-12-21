import { IsNotEmpty, IsString } from 'class-validator'

export class CancelPayPalOrderDto {
	@IsString()
	@IsNotEmpty()
	orderId: string
}
