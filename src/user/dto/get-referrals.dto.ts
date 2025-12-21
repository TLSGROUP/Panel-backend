import { IsIn, IsOptional, IsString } from 'class-validator'

export class GetReferralsDto {
	@IsOptional()
	@IsString()
	page?: string

	@IsOptional()
	@IsString()
	limit?: string

	@IsOptional()
	@IsString()
	search?: string

	@IsOptional()
	@IsString()
	from_date?: string

	@IsOptional()
	@IsString()
	to_date?: string

	@IsOptional()
	@IsString()
	@IsIn(['id', 'name', 'lastName', 'email', 'phone', 'country', 'city', 'createdAt'])
	sort_by?: string

	@IsOptional()
	@IsString()
	@IsIn(['asc', 'desc'])
	sort_order?: string
}
