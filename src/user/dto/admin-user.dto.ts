import { SUPPORTED_LANGUAGES } from '@/language/language.constants'
import { IsArray, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator'
import { Role } from 'prisma/generated/enums'
import { PartialType } from '@nestjs/mapped-types'

export class AdminUserDto {
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
	avatarPath?: string

	@IsOptional()
	@IsString()
	country?: string

	@IsOptional()
	@IsString()
	city?: string

	@IsOptional()
	@IsString()
	phone?: string

	@IsOptional()
	@IsString()
	@MinLength(6)
	password?: string

	@IsOptional()
	@IsArray()
	@IsIn(Object.values(Role), { each: true })
	rights?: Role[]

	@IsOptional()
	@IsIn(SUPPORTED_LANGUAGES)
	language?: string
}

export class UpdateAdminUserDto extends PartialType(AdminUserDto) {}
