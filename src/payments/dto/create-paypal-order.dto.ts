import { IsNotEmpty, IsString } from 'class-validator'

export class CreatePayPalOrderDto {
	@IsString()
	@IsNotEmpty()
	planId: string
}
