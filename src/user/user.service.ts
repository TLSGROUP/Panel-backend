import { AuthDto } from '@/auth/dto/auth.dto'
import { TUserSocial } from '@/auth/social-media/social-media-auth.types'
import { buildReferralLink, VERIFY_EMAIL_URL } from '@/constants'
import { EmailService } from '@/email/email.service'
import {
	DEFAULT_LANGUAGE,
	normalizeLanguage,
	type Language
} from '@/language/language.constants'
import { Injectable } from '@nestjs/common'
import type { UserModel as User } from 'prisma/generated/models'
import { hash } from 'argon2'
import { path as appRootPath } from 'app-root-path'
import { remove } from 'fs-extra'

import { PrismaService } from 'src/prisma.service'
import { PaginationArgsWithSearchTerm } from '@/base/pagination/paginations.args'
import { UserResponse } from './user.response'
import { isHasMorePagination } from '@/base/pagination/is-has-more'
import { Prisma } from 'prisma/generated/client'
import { Role } from 'prisma/generated/enums'
import { AdminUserDto, UpdateAdminUserDto } from './dto/admin-user.dto'
import * as geoipLite from 'geoip-lite'

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
				lastName: true,
				email: true,
				id: true,
				password: false,
				language: true,
				country: true,
				city: true,
				phone: true
			}
		})
	}

	async getById(id: string) {
		const user = await this.prisma.user.findUnique({
			where: {
				id
			}
		})

		return this._ensureReferralData(user)
	}

	async getByEmail(email: string) {
		const user = await this.prisma.user.findUnique({
			where: {
				email
			}
		})

		return this._ensureReferralData(user)
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

		return this._createUserWithGeneratedId(
			{
				email: profile.email || '',
				name: profile.name || '',
				password: '',
				language,
				...verificationToken,
				avatarPath: profile.avatarPath || null
			},
			profile.name || profile.email
		)
	}

	async create(dto: AuthDto) {
		const payload: Prisma.UserCreateInput = {
			...dto,
			lastName: dto.lastName,
			phone: dto.phone,
			city: dto.city,
			password: await hash(dto.password),
			language: dto.language ?? DEFAULT_LANGUAGE
		}

		return this._createUserWithGeneratedId(payload, dto.name || dto.email)
	}

	async createByAdmin(dto: AdminUserDto) {
		const password = dto.password ? await hash(dto.password) : null
		return this._createUserWithGeneratedId(
			{
				email: dto.email,
				name: dto.name,
				lastName: dto.lastName,
				phone: dto.phone,
				city: dto.city,
				password,
				avatarPath: dto.avatarPath,
				country: dto.country,
				language: normalizeLanguage(dto.language),
				rights: dto.rights ?? [Role.USER]
			},
			dto.name || dto.email
		)
	}

	async update(id: string, data: Partial<User>) {
		const previousUser = await this.prisma.user.findUnique({
			where: { id },
			select: { avatarPath: true }
		})

		const user = await this.prisma.user.update({
			where: {
				id
			},
			data
		})

		await this._removeObsoleteAvatar(previousUser?.avatarPath, user.avatarPath)

		if (user.verificationToken) {
			await this.emailService.sendVerification(
				user.email,
				`${VERIFY_EMAIL_URL}${user.verificationToken}`,
				normalizeLanguage(user.language)
			)
		}

		return user
	}

	async updateByAdmin(id: string, dto: UpdateAdminUserDto) {
		const previousUser = await this.prisma.user.findUnique({
			where: { id },
			select: { avatarPath: true }
		})

		const data: Prisma.UserUpdateInput = {
			email: dto.email,
			name: dto.name,
			lastName: dto.lastName,
			phone: dto.phone,
			city: dto.city,
			avatarPath: dto.avatarPath,
			country: dto.country,
			language: dto.language ? normalizeLanguage(dto.language) : undefined,
			rights: dto.rights
		}

		if (dto.password) {
			data.password = await hash(dto.password)
		}

		const updatedUser = await this.prisma.user.update({
			where: { id },
			data
		})

		await this._removeObsoleteAvatar(previousUser?.avatarPath, updatedUser.avatarPath)

		return updatedUser
	}

	async delete(id: string) {
		return this.prisma.user.delete({
			where: {
				id
			}
		})
	}

	private getSearchTermFilter(searchTerm: string): Prisma.UserWhereInput {
		return {
			OR: [
				{ name: { contains: searchTerm, mode: 'insensitive' } },
				{ lastName: { contains: searchTerm, mode: 'insensitive' } },
				{ email: { contains: searchTerm, mode: 'insensitive' } },
				{ phone: { contains: searchTerm, mode: 'insensitive' } }
			]
		}
	}

	detectCountryByIp(ipAddress?: string | null) {
		if (!ipAddress) {
			return { countryCode: null }
		}

		const normalizedIp = this._normalizeIp(ipAddress)
		if (!normalizedIp) {
			return { countryCode: null }
		}

		const lookupResult = geoipLite.lookup(normalizedIp)

		return {
			countryCode: lookupResult?.country ?? null
		}
	}

	private _normalizeIp(ipAddress: string) {
		if (!ipAddress) {
			return null
		}

		const cleaned = ipAddress.includes(',')
			? ipAddress.split(',')[0]?.trim()
			: ipAddress.trim()

		if (!cleaned) {
			return null
		}

		if (cleaned.startsWith('::ffff:')) {
			return cleaned.substring(7)
		}

		if (cleaned === '::1') {
			return null
		}

		return cleaned
	}

	private async _removeObsoleteAvatar(
		previousPath?: string | null,
		currentPath?: string | null
	) {
		if (!previousPath) {
			return
		}

		if (previousPath === currentPath) {
			return
		}

		const isUploadPath = previousPath.startsWith('/uploads/')
		if (!isUploadPath) {
			return
		}

		const normalizedPath = previousPath.startsWith('/')
			? previousPath
			: `/${previousPath}`

		try {
			await remove(`${appRootPath}${normalizedPath}`)
		} catch (error) {
			console.warn(`Failed to remove old avatar: ${normalizedPath}`, error)
		}
	}

	private async _ensureReferralData(user: User | null) {
		if (!user) {
			return null
		}

		if (user.referralCode && user.referralLink) {
			return user
		}

		const referralCode = user.referralCode || user.id
		const referralLink = user.referralLink || buildReferralLink(referralCode)

		return this.prisma.user.update({
			where: {
				id: user.id
			},
			data: {
				referralCode,
				referralLink
			}
		})
	}

	private async _createUserWithGeneratedId(
		data: Prisma.UserCreateInput,
		source?: string | null
	) {
		let attempts = 0

		while (attempts < 5) {
			const id = await this._generateUserId(source || (typeof data.name === 'string' ? data.name : null))

			try {
				const referralCode = id
				const referralLink = buildReferralLink(referralCode)

				return await this.prisma.user.create({
					data: {
						...data,
						id,
						referralCode,
						referralLink
					}
				})
			} catch (error) {
				if (
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === 'P2002'
				) {
					attempts += 1
					continue
				}

				throw error
			}
		}

		throw new Error('Failed to generate unique user id')
	}

	private async _generateUserId(source?: string | null) {
		const prefix = this._buildIdPrefix(source)

		const lastUser = await this.prisma.user.findFirst({
			where: {
				id: {
					startsWith: prefix
				}
			},
			orderBy: {
				id: 'desc'
			},
			select: {
				id: true
			}
		})

		const lastNumber = lastUser
			? Number.parseInt(lastUser.id.slice(prefix.length), 10) || 0
			: 0
		const nextNumber = lastNumber + 1
		const suffix = nextNumber.toString()

		return `${prefix}${suffix}`
	}

	private _buildIdPrefix(source?: string | null) {
		const fallback = 'user'
		const normalized = source?.trim().replace(/\s+/g, '') ?? ''
		const base = normalized || fallback

		return base.slice(0, 2).padEnd(2, 'x').toUpperCase()
	}
}
