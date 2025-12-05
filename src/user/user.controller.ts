import { Auth } from '@/auth/decorators/auth.decorator'
import { CurrentUser } from '@/auth/decorators/user.decorator'
import {
	Body,
	Controller,
	Get,
	HttpCode,
	Patch,
	UsePipes,
	ValidationPipe
} from '@nestjs/common'
import { Role } from 'prisma/generated/enums'
import { UserService } from './user.service'

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
}
