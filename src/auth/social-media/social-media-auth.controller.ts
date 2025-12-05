import { AuthService } from '@/auth/auth.service'
import { RefreshTokenService } from '@/auth/refresh-token.service'
import { SocialMediaAuthService } from '@/auth/social-media/social-media-auth.service'

import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request, Response } from 'express'
import { TUserSocial } from './social-media-auth.types'
import {
	LANGUAGE_COOKIE_NAME,
	normalizeLanguage
} from '@/language/language.constants'

@Controller('auth')
export class SocialMediaAuthController {
	constructor(
		private readonly socialMediaAuthService: SocialMediaAuthService,
		private readonly authService: AuthService,
		private readonly refreshTokenService: RefreshTokenService
	) {}

	private _CLIENT_BASE_URL = 'http://localhost:3000/social-auth?accessToken='

	// Google
	@Get('google')
	@UseGuards(AuthGuard('google'))
	async googleAuth() {}

	@Get('google/redirect')
	@UseGuards(AuthGuard('google'))
	async googleAuthRedirect(
		@Req() req: Request & { user: TUserSocial },
		@Res({ passthrough: true }) res: Response
	) {
		const preferredLanguage = normalizeLanguage(
			req.cookies[LANGUAGE_COOKIE_NAME] as string | undefined
		)

		const user = await this.socialMediaAuthService.login(
			req,
			preferredLanguage
		)
		const { accessToken, refreshToken } =
			await this.authService.buildResponseObject(user)
		this.refreshTokenService.addRefreshTokenToResponse(res, refreshToken)
		return res.redirect(`${this._CLIENT_BASE_URL}${accessToken}`)
	}
}
