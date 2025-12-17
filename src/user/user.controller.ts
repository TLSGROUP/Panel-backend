import { Auth } from '@/auth/decorators/auth.decorator'
import { CurrentUser } from '@/auth/decorators/user.decorator'
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Patch,
	Post,
	Put,
	Query,
	Req,
	UsePipes,
	ValidationPipe
} from '@nestjs/common'
import { Role } from 'prisma/generated/enums'
import { UserService } from './user.service'
import { PaginationArgsWithSearchTerm } from '@/base/pagination/paginations.args'
import { AdminUserDto, UpdateAdminUserDto } from './dto/admin-user.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import type { Request } from 'express'

@Controller('users')
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Auth()
	@Get('profile')
	async getProfile(@CurrentUser('id') id: string) {
		return this.userService.getById(id)
	}

	@Auth()
	@Get('detect-country')
	detectCountry(@Req() req: Request) {
		const forwardedFor = req.headers['x-forwarded-for']
		const forwardedIp = Array.isArray(forwardedFor)
			? forwardedFor[0]
			: forwardedFor

		const ip =
			forwardedIp ||
			req.ip ||
			req.socket.remoteAddress ||
			req.connection.remoteAddress ||
			null

		return this.userService.detectCountryByIp(ip)
	}

	@UsePipes(new ValidationPipe())
	@HttpCode(200)
	@Auth()
	@Patch('update-email')
	async updateEmail(
		@CurrentUser('id') userId: string,
		@Body() dto: { email: string }
	) {
		return this.userService.update(userId, { email: dto.email })
	}

	@UsePipes(new ValidationPipe())
	@HttpCode(200)
	@Auth()
	@Patch('profile')
	async updateProfile(
		@CurrentUser('id') userId: string,
		@Body() dto: UpdateProfileDto
	) {
		return this.userService.update(userId, dto)
	}

	@Auth()
	@Get()
	async getPaginatedList(@Query() params: PaginationArgsWithSearchTerm){
		return this.userService.findAll(params)
	}

	@Auth([Role.ADMIN, Role.MANAGER])
	@Get('manager')
	async getManagerContent() {
		return { text: 'Manager content' }
	}

	@Auth(Role.ADMIN)
	@Get('list')
	async getList() {
		return this.userService.getUsers()
	}

	@Auth(Role.ADMIN)
	@Get(':id')
	async getUser(@Param('id') id: string) {
		return this.userService.getById(id)
	}

	@Auth(Role.ADMIN)
	@UsePipes(new ValidationPipe())
	@Post()
	async createUser(@Body() dto: AdminUserDto) {
		return this.userService.createByAdmin(dto)
	}

	@Auth(Role.ADMIN)
	@UsePipes(new ValidationPipe())
	@Put(':id')
	async updateUser(
		@Param('id') id: string,
		@Body() dto: UpdateAdminUserDto
	) {
		return this.userService.updateByAdmin(id, dto)
	}

	@Auth(Role.ADMIN)
	@Delete(':id')
	async deleteUser(@Param('id') id: string) {
		return this.userService.delete(id)
	}
}
