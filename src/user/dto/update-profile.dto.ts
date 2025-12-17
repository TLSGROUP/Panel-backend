import { IsOptional, IsString } from 'class-validator'

export class UpdateProfileDto {
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
	country?: string

	@IsOptional()
	@IsString()
	city?: string

	@IsOptional()
	@IsString()
	avatarPath?: string
}
