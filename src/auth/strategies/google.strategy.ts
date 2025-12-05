import { AuthService } from '@/auth/auth.service'
import {
	IGoogleProfile,
	TSocialCallback
} from '@/auth/social-media/social-media-auth.types'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-google-oauth20'

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
	constructor(
		private configService: ConfigService,
		private authService: AuthService
	) {
		super({
			clientID: configService.get('GOOGLE_CLIENT_ID'),
			clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
			callbackURL: configService.get('GOOGLE_CALLBACK_URL'),
			scope: ['email', 'profile']
		})
	}

	async validate(
		accessToken: string,
		refreshToken: string,
		profile: IGoogleProfile,
		done: TSocialCallback
	): Promise<any> {
		done(null, {
			avatarPath: profile.photos[0].value,
			email: profile.emails[0].value,
			name: profile.displayName
		})
	}
}
