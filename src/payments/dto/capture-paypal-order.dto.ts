import { IsNotEmpty, IsString } from 'class-validator'

export class CapturePayPalOrderDto {
	@IsString()
	@IsNotEmpty()
	orderId: string
}
