import { applyDecorators, UseGuards } from '@nestjs/common'
import { Role } from 'prisma/generated/enums'
import { JwtAuthGuard } from '../guards/jwt.guard'
import { RolesGuard } from '../guards/roles.guard'
import { Roles } from './roles.decorator'

export const Auth = (roles: Role | Role[] = [Role.USER, Role.MANAGER, Role.ADMIN]) => {
	if (!Array.isArray(roles)) {
		roles = [roles]
	}
	return applyDecorators(Roles(...roles), UseGuards(JwtAuthGuard, RolesGuard))
}
