import { TUserSocial } from '@/auth/social-media/social-media-auth.types'
import { UserService } from '@/user/user.service'
import { BadRequestException, Injectable } from '@nestjs/common'
import type { Language } from '@/language/language.constants'

@Injectable()
export class SocialMediaAuthService {
	constructor(private userService: UserService) {}

	async login(req: { user: TUserSocial }, preferredLanguage?: Language) {
		if (!req.user) {
			throw new BadRequestException('User not found by social media')
		}

		return this.userService.findOrCreateSocialUser(req.user, preferredLanguage)
	}
}
