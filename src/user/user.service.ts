import { AuthDto } from '@/auth/dto/auth.dto'
import { TUserSocial } from '@/auth/social-media/social-media-auth.types'
import { VERIFY_EMAIL_URL } from '@/constants'
import { EmailService } from '@/email/email.service'
import {
	DEFAULT_LANGUAGE,
	normalizeLanguage,
	type Language
} from '@/language/language.constants'
import { Injectable } from '@nestjs/common'
import type { UserModel as User } from 'prisma/generated/models'
import { hash } from 'argon2'

import { PrismaService } from 'src/prisma.service'
import { PaginationArgsWithSearchTerm } from '@/base/pagination/paginations.args'
import { UserResponse } from './user.response'
import { isHasMorePagination } from '@/base/pagination/is-has-more'
import { Prisma } from 'prisma/generated/client'

@Injectable()
export class UserService {
	constructor(
		private prisma: PrismaService,
		private emailService: EmailService
	) {}

	async getUsers() {
		return this.prisma.user.findMany({
			select: {
				name: true,
				email: true,
				id: true,
				password: false,
				language: true,
				country: true
			}
		})
	}

	async getById(id: string) {
		return this.prisma.user.findUnique({
			where: {
				id
			}
		})
	}

	async getByEmail(email: string) {
		return this.prisma.user.findUnique({
			where: {
				email
			}
		})
	}

	async findAll(args?: PaginationArgsWithSearchTerm):Promise<UserResponse> {
		const SearchTermQuery = args?.searchTerm
			? this.getSearchTermFilter(args?.searchTerm)
			:{}
		const skip = args?.skip ? Number(args.skip) : undefined
		const take = args?.take ? Number(args.take) : undefined

		const users = await this.prisma.user.findMany({
			skip,
			take,
			where: SearchTermQuery,
	    })
		const totalCount = await this.prisma.user.count({
			where: SearchTermQuery,
		})
		
		const isHasMore = isHasMorePagination(totalCount, skip, take)
		return {
			items:
			users,
			isHasMore
		}
	}

	async findOrCreateSocialUser(
		profile: TUserSocial,
		preferredLanguage?: Language
	) {
		const email = profile.email
		let user: User | null = null

		if (email) {
			user = await this.getByEmail(email)
		}

		if (!user) {
			user = await this._createSocialUser(
				profile,
				preferredLanguage ?? DEFAULT_LANGUAGE
			)
		}

		return user
	}

	private async _createSocialUser(
		profile: TUserSocial,
		language: Language = DEFAULT_LANGUAGE
	): Promise<User> {
		const verificationToken = profile.email
			? {
					verificationToken: null
				}
			: {}

		return this.prisma.user.create({
			data: {
				email: profile.email || '',
				name: profile.name || '',
				password: '',
				language,
				...verificationToken,
				avatarPath: profile.avatarPath || null
			}
		})
	}

	async create(dto: AuthDto) {
		return this.prisma.user.create({
			data: {
				...dto,
				password: await hash(dto.password),
				language: dto.language ?? DEFAULT_LANGUAGE
			}
		})
	}

	async update(id: string, data: Partial<User>) {
		const user = await this.prisma.user.update({
			where: {
				id
			},
			data
		})

		if (user.verificationToken) {
			await this.emailService.sendVerification(
				user.email,
				`${VERIFY_EMAIL_URL}${user.verificationToken}`,
				normalizeLanguage(user.language)
			)
		}

		return user
	}
	private getSearchTermFilter(searchTerm: string): Prisma.UserWhereInput {
		return {
			OR: [
				{ name: { contains: searchTerm, mode: 'insensitive' } },
				{ email: { contains: searchTerm, mode: 'insensitive' } }
			]
		}
	}
}
