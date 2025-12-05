import {
	Body,
	Controller,
	Get,
	HttpCode,
	Post,
	Query,
	Req,
	Res,
	UnauthorizedException,
	UsePipes,
	ValidationPipe
} from '@nestjs/common'
import { Recaptcha } from '@nestlab/google-recaptcha'
import { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { AuthDto, RegisterDto } from './dto/auth.dto'
import {
	PasswordResetDto,
	PasswordResetRequestDto,
	PasswordResetVerifyDto
} from './dto/password-reset.dto'
import { LanguagePreferenceDto } from './dto/language-preference.dto'
import { RefreshTokenService } from './refresh-token.service'
import {
	LANGUAGE_COOKIE_MAX_AGE,
	LANGUAGE_COOKIE_NAME
} from '@/language/language.constants'

@Controller()
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly refreshTokenService: RefreshTokenService
	) {}

	@UsePipes(new ValidationPipe())
	@HttpCode(200)
	@Recaptcha()
	@Post('auth/login')
	async login(@Body() dto: AuthDto, @Res({ passthrough: true }) res: Response) {
		const { refreshToken, ...response } = await this.authService.login(dto)

		this.refreshTokenService.addRefreshTokenToResponse(res, refreshToken)

		return response
	}

	@UsePipes(new ValidationPipe())
	@HttpCode(200)
	@Recaptcha()
	@Post('auth/register')
	async register(
		@Body() dto: RegisterDto,
		@Res({ passthrough: true }) res: Response
	) {
		const { refreshToken, ...response } = await this.authService.register(dto)
		this.refreshTokenService.addRefreshTokenToResponse(res, refreshToken)
		return response
	}

	@HttpCode(200)
	@Get('verify-email')
	async verifyEmail(@Query('token') token?: string) {
		if (!token) {
			throw new UnauthorizedException('Token not passed')
		}

		return this.authService.verifyEmail(token)
	}

	@HttpCode(200)
	@Post('auth/access-token')
	async getNewTokens(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response
	) {
		const refreshTokenFromCookies =
			req.cookies[this.refreshTokenService.REFRESH_TOKEN_NAME]

		if (!refreshTokenFromCookies) {
			this.refreshTokenService.removeRefreshTokenFromResponse(res)
			throw new UnauthorizedException('Refresh token not passed')
		}

		const { refreshToken, ...response } = await this.authService.getNewTokens(
			refreshTokenFromCookies
		)

		this.refreshTokenService.addRefreshTokenToResponse(res, refreshToken)

		return response
	}

	@HttpCode(200)
	@Post('auth/logout')
	async logout(@Res({ passthrough: true }) res: Response) {
		this.refreshTokenService.removeRefreshTokenFromResponse(res)

		return true
	}

	@UsePipes(new ValidationPipe())
	@HttpCode(200)
	@Post('auth/password/forgot')
	async forgotPassword(@Body() dto: PasswordResetRequestDto) {
		return this.authService.requestPasswordReset(dto)
	}

	@UsePipes(new ValidationPipe())
	@HttpCode(200)
	@Post('auth/password/verify')
	async verifyResetCode(@Body() dto: PasswordResetVerifyDto) {
		return this.authService.verifyResetCode(dto)
	}

	@UsePipes(new ValidationPipe())
	@HttpCode(200)
	@Post('auth/password/reset')
	async resetPassword(@Body() dto: PasswordResetDto) {
		return this.authService.resetPassword(dto)
	}

	@UsePipes(new ValidationPipe())
	@HttpCode(200)
	@Post('auth/language')
	setLanguagePreference(
		@Body() dto: LanguagePreferenceDto,
		@Res({ passthrough: true }) res: Response
	) {
		res.cookie(LANGUAGE_COOKIE_NAME, dto.language, {
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: LANGUAGE_COOKIE_MAX_AGE
		})

		return { success: true }
	}
}
