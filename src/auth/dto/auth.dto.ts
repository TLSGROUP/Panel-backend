import {
	IsEmail,
	IsIn,
	IsNotEmpty,
	IsOptional,
	IsString,
	MinLength
} from 'class-validator'
import { SUPPORTED_LANGUAGES, type Language } from '@/language/language.constants'

export class AuthDto {
	@IsEmail()
	email: string

	@IsOptional()
	@IsString()
	name?: string

	@IsOptional()
	@IsString()
	lastName?: string

	@IsOptional()
	@IsString()
	phone?: string

	@IsOptional()
	@IsString()
	city?: string

	@MinLength(6, {
		message: 'Password must be at least 6 characters long',
	})
	@IsString()
	password: string

	@IsOptional()
	@IsIn(SUPPORTED_LANGUAGES)
	language?: Language
}

export class RegisterDto extends AuthDto {
	@IsNotEmpty()
	@IsString()
	override name: string
}
