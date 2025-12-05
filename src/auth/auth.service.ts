import { VERIFY_EMAIL_URL } from '@/constants'
import { EmailService } from '@/email/email.service'
import { PrismaService } from '@/prisma.service'
import { UserService } from '@/user/user.service'
import {
	BadRequestException,
	Injectable,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Role } from 'prisma/generated/enums'
import type { UserModel as User } from 'prisma/generated/models'
import { omit } from 'lodash'
import { hash, verify } from 'argon2'
import { normalizeLanguage } from '@/language/language.constants'
import { AuthDto, RegisterDto } from './dto/auth.dto'
import {
	PasswordResetDto,
	PasswordResetRequestDto,
	PasswordResetVerifyDto
} from './dto/password-reset.dto'

@Injectable()
export class AuthService {
	constructor(
		private jwt: JwtService,
		private userService: UserService,
		private emailService: EmailService,
		private prisma: PrismaService
	) {}

	private readonly TOKEN_EXPIRATION_ACCESS = '1h'
	private readonly TOKEN_EXPIRATION_REFRESH = '7d'
	private readonly RESET_CODE_EXPIRATION_MINUTES = 15

	async login(dto: AuthDto) {
		const user = await this.validateUser(dto)
		return this.buildResponseObject(user)
	}

	async register(dto: RegisterDto) {
		const userExists = await this.userService.getByEmail(dto.email)
		if (userExists) {
			throw new BadRequestException('User already exists')
		}
		const user = await this.userService.create(dto)

		await this.emailService.sendVerification(
			user.email,
			`${VERIFY_EMAIL_URL}${user.verificationToken}`,
			normalizeLanguage(user.language)
		)

		return this.buildResponseObject(user)
	}

	async getNewTokens(refreshToken: string) {
		const result = await this.jwt.verifyAsync(refreshToken)
		if (!result) {
			throw new UnauthorizedException('Invalid refresh token')
		}
		const user = await this.userService.getById(result.id)
		return this.buildResponseObject(user)
	}

	async verifyEmail(token: string) {
		const user = await this.prisma.user.findFirst({
			where: {
				verificationToken: token
			}
		})

		if (!user) throw new NotFoundException('Token not exists!')

		await this.userService.update(user.id, {
			verificationToken: null
		})

		return 'Email verified!'
	}

	async buildResponseObject(user: User) {
		const tokens = await this.issueTokens(user.id, user.rights || [])
		return { user: this.omitPassword(user), ...tokens }
	}

	private async issueTokens(userId: string, rights: Role[]) {
		const payload = { id: userId, rights }
		const accessToken = this.jwt.sign(payload, {
			expiresIn: this.TOKEN_EXPIRATION_ACCESS
		})
		const refreshToken = this.jwt.sign(payload, {
			expiresIn: this.TOKEN_EXPIRATION_REFRESH
		})
		return { accessToken, refreshToken }
	}

	private async validateUser(dto: AuthDto) {
		const user = await this.userService.getByEmail(dto.email)
		if (!user) {
			throw new UnauthorizedException('Email or password invalid')
		}
		const isValid = await verify(user.password, dto.password)
		if (!isValid) {
			throw new UnauthorizedException('Email or password invalid')
		}
		return user
	}

	private omitPassword(user: User) {
		return omit(user, ['password'])
	}

	async requestPasswordReset(dto: PasswordResetRequestDto) {
		const user = await this.userService.getByEmail(dto.email)

		if (!user) {
			throw new NotFoundException('User with this email not found')
		}

		const code = this.generateResetCode()
		await this.prisma.user.update({
			where: { id: user.id },
			data: {
				passwordResetCode: await hash(code),
				passwordResetExpires: this.getResetExpirationDate()
			}
		})

		await this.emailService.sendPasswordResetCode(
			dto.email,
			code,
			normalizeLanguage(user.language)
		)

		return { success: true }
	}

	async verifyResetCode(dto: PasswordResetVerifyDto) {
		await this.ensureValidResetCode(dto.email, dto.code)
		return { success: true }
	}

	async resetPassword(dto: PasswordResetDto) {
		const user = await this.ensureValidResetCode(dto.email, dto.code)

		await this.prisma.user.update({
			where: { id: user.id },
			data: {
				password: await hash(dto.password),
				passwordResetCode: null,
				passwordResetExpires: null
			}
		})

		return { success: true }
	}

	private generateResetCode() {
		return Math.floor(100000 + Math.random() * 900000).toString()
	}

	private getResetExpirationDate() {
		const expires = new Date()
		expires.setMinutes(expires.getMinutes() + this.RESET_CODE_EXPIRATION_MINUTES)
		return expires
	}

	private async ensureValidResetCode(email: string, code: string) {
		const user = await this.userService.getByEmail(email)

		if (!user || !user.passwordResetCode || !user.passwordResetExpires) {
			throw new BadRequestException('Reset code is invalid or expired')
		}

		if (user.passwordResetExpires.getTime() < Date.now()) {
			throw new BadRequestException('Reset code expired')
		}

		const isValid = await verify(user.passwordResetCode, code)

		if (!isValid) {
			throw new BadRequestException('Reset code is invalid')
		}

		return user
	}
}
