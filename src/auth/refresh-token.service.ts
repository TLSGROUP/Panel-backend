import { Injectable } from '@nestjs/common'
import type { Response } from 'express'

@Injectable()
export class RefreshTokenService {
	readonly EXPIRE_DAY_REFRESH_TOKEN = 1
	readonly REFRESH_TOKEN_NAME = 'refreshToken'

	addRefreshTokenToResponse(res: Response, refreshToken: string) {
		const isProd = process.env.NODE_ENV === 'production'
		const configuredDomain = process.env.COOKIE_DOMAIN
		const domain =
			configuredDomain && configuredDomain !== 'localhost'
				? configuredDomain
				: undefined
		const secure =
			typeof process.env.COOKIE_SECURE === 'string'
				? process.env.COOKIE_SECURE === 'true'
				: isProd
		const sameSite =
			(process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') ||
			(isProd ? 'lax' : 'lax')
		const effectiveSecure = sameSite === 'none' ? true : secure

		const expiresIn = new Date()
		expiresIn.setDate(expiresIn.getDate() + this.EXPIRE_DAY_REFRESH_TOKEN)

		res.cookie(this.REFRESH_TOKEN_NAME, refreshToken, {
			httpOnly: true,
			domain,
			expires: expiresIn,
			secure: effectiveSecure,
			sameSite
		})
	}

	removeRefreshTokenFromResponse(res: Response) {
		const isProd = process.env.NODE_ENV === 'production'
		const configuredDomain = process.env.COOKIE_DOMAIN
		const domain =
			configuredDomain && configuredDomain !== 'localhost'
				? configuredDomain
				: undefined
		const secure =
			typeof process.env.COOKIE_SECURE === 'string'
				? process.env.COOKIE_SECURE === 'true'
				: isProd
		const sameSite =
			(process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') ||
			(isProd ? 'lax' : 'lax')
		const effectiveSecure = sameSite === 'none' ? true : secure

		res.cookie(this.REFRESH_TOKEN_NAME, '', {
			httpOnly: true,
			domain,
			expires: new Date(0),
			secure: effectiveSecure,
			sameSite
		})
	}
}
