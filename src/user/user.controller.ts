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
	Query,
	UsePipes,
	ValidationPipe
} from '@nestjs/common'
import { Role } from 'prisma/generated/enums'
import { UserService } from './user.service'
import { PaginationArgsWithSearchTerm } from '@/base/pagination/paginations.args'

@Controller('users')
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Auth()
	@Get('profile')
	async getProfile(@CurrentUser('id') id: string) {
		return this.userService.getById(id)
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
	@Delete(':id')
	async deleteUser(@Param('id') id: string) {
		return this.userService.delete(id)
	}
}
