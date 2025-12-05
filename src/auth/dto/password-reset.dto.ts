import {
	IsEmail,
	IsNotEmpty,
	IsString,
	Length,
	MinLength
} from 'class-validator'

export class PasswordResetRequestDto {
	@IsEmail()
	@IsNotEmpty()
	email: string
}

export class PasswordResetVerifyDto extends PasswordResetRequestDto {
	@IsString()
	@Length(6, 6)
	code: string
}

export class PasswordResetDto extends PasswordResetVerifyDto {
	@IsString()
	@MinLength(6)
	password: string
}
