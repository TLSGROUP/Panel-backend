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
import { BinaryLeg, Role } from 'prisma/generated/enums'
import { AdminUserDto, UpdateAdminUserDto } from './dto/admin-user.dto'
import { GetReferralsDto } from './dto/get-referrals.dto'
import * as geoipLite from 'geoip-lite'
import { BinaryModule } from '@/mlm-engine/modules/binary.module'

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

	async getUserReferrals(userId: string, query: GetReferralsDto) {
		const page = Math.max(Number(query.page) || 1, 1)
		const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100)
		const skip = (page - 1) * limit

		const where: Prisma.UserWhereInput = {
			referrerId: userId
		}

		const search = query.search?.trim()
		if (search) {
			const contains = () => ({
				contains: search,
				mode: Prisma.QueryMode.insensitive
			})

			where.OR = [
				{ id: contains() },
				{ name: contains() },
				{ lastName: contains() },
				{ email: contains() },
				{ phone: contains() },
				{ country: contains() },
				{ city: contains() }
			]
		}

		const createdAtFilter: Prisma.DateTimeFilter = {}
		const fromDate = this._parseDate(query.from_date)
		if (fromDate) {
			createdAtFilter.gte = fromDate
		}

		const toDate = this._parseDate(query.to_date, true)
		if (toDate) {
			createdAtFilter.lte = toDate
		}

		if (Object.keys(createdAtFilter).length > 0) {
			where.createdAt = createdAtFilter
		}

		const allowedSortFields: (keyof Prisma.UserOrderByWithRelationInput)[] = [
			'id',
			'name',
			'lastName',
			'email',
			'phone',
			'country',
			'city',
			'createdAt'
		]
		const sortField = allowedSortFields.includes(
			query.sort_by as keyof Prisma.UserOrderByWithRelationInput
		)
			? (query.sort_by as keyof Prisma.UserOrderByWithRelationInput)
			: 'createdAt'
		const sortOrder = query.sort_order === 'asc' ? 'asc' : 'desc'

		const [items, totalItems] = await this.prisma.$transaction([
			this.prisma.user.findMany({
				where,
				skip,
				take: limit,
				orderBy: {
					[sortField]: sortOrder
				},
				select: {
					id: true,
					name: true,
					lastName: true,
					email: true,
					phone: true,
					country: true,
					city: true,
					createdAt: true
				}
			}),
			this.prisma.user.count({ where })
		])

		return {
			success: true,
			data: items,
			pagination: {
				page,
				limit,
				total_pages: Math.max(1, Math.ceil(totalItems / limit)),
				total_items: totalItems
			}
		}
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
		const { referralCode, ...restDto } = dto
		const referrerId = await this._resolveReferrerId(referralCode)

		const payload: Prisma.UserCreateInput = {
			...restDto,
			lastName: dto.lastName,
			phone: dto.phone,
			city: dto.city,
			password: await hash(dto.password),
			language: dto.language ?? DEFAULT_LANGUAGE
		}

		return this._createUserWithGeneratedId(payload, dto.name || dto.email, referrerId)
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
			dto.name || dto.email,
			undefined
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

	private async _resolveReferrerId(referralCode?: string | null) {
		if (!referralCode) {
			return null
		}

		const referrer = await this.prisma.user.findFirst({
			where: {
				OR: [
					{ referralCode },
					{ id: referralCode }
				]
			},
			select: {
				id: true
			}
		})

		return referrer?.id ?? null
	}

	private async _createUserWithGeneratedId(
		data: Prisma.UserCreateInput,
		source?: string | null,
		referrerId?: string | null
	) {
		let attempts = 0

		while (attempts < 5) {
			const id = await this._generateUserId(source || (typeof data.name === 'string' ? data.name : null))

			try {
				const referralCode = id
				const referralLink = buildReferralLink(referralCode)

					const createData: Prisma.UserCreateInput = {
						...data,
						id,
						referralCode,
						referralLink
					}

					if (referrerId) {
						createData.referrer = {
							connect: {
								id: referrerId
							}
						}
					}

					return await this.prisma.$transaction(async (tx) => {
						const user = await tx.user.create({
							data: createData
						})

						await this._placeNewUserInBinary(tx, user.id, referrerId)

						return user
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

	private async _ensureBinaryNodeExists(
		tx: Prisma.TransactionClient,
		userId: string
	) {
		await tx.mlmBinaryNode.upsert({
			where: { userId },
			update: {},
			create: {
				userId,
				parentUserId: null,
				leg: null
			}
		})
	}

	private async _placeNewUserInBinary(
		tx: Prisma.TransactionClient,
		newUserId: string,
		referrerId?: string | null
	) {
		if (!referrerId) {
			await this._ensureBinaryNodeExists(tx, newUserId)
			return
		}

		await this._ensureBinaryNodeExists(tx, referrerId)

		const settings = await this._loadBinaryPlacementSettings(tx)
		const refNode = await tx.mlmBinaryNode.findUnique({
			where: { userId: referrerId },
			select: {
				leftCount: true,
				rightCount: true,
				leftBvTotal: true,
				rightBvTotal: true,
				lastAssignLeg: true
			}
		})
		if (!refNode) {
			throw new Error('Binary referrer node not found')
		}

		const directOrder = this._getSlotOrder(refNode, settings, newUserId)
		const placed = await this._tryPlaceUnderCandidate(
			tx,
			newUserId,
			referrerId,
			directOrder
		)
		if (placed) {
			await this._incrementCountsUpTree(tx, placed.parentUserId, placed.leg)
			return
		}

		if (settings.spilloverMode === 'weak_leg_bfs') {
			const preferredLeg = this._getWeakLeg(refNode, settings, newUserId)
			const firstChild = await this._getChildByLeg(tx, referrerId, preferredLeg)
			const secondChild = await this._getChildByLeg(
				tx,
				referrerId,
				preferredLeg === 'LEFT' ? 'RIGHT' : 'LEFT'
			)

			if (firstChild) {
				const found = await this._bfsPlace(
					tx,
					newUserId,
					firstChild,
					settings
				)
				if (found) {
					await this._incrementCountsUpTree(tx, found.parentUserId, found.leg)
					return
				}
			}

			if (secondChild) {
				const found = await this._bfsPlace(
					tx,
					newUserId,
					secondChild,
					settings
				)
				if (found) {
					await this._incrementCountsUpTree(tx, found.parentUserId, found.leg)
					return
				}
			}
		} else {
			const found = await this._bfsPlace(tx, newUserId, referrerId, settings)
			if (found) {
				await this._incrementCountsUpTree(tx, found.parentUserId, found.leg)
				return
			}
		}

		throw new Error('Failed to place user in binary tree')
	}

	private async _loadBinaryPlacementSettings(tx: Prisma.TransactionClient) {
		const persisted = await tx.mlmEngineSetting.findUnique({
			where: { moduleKey: 'binary' }
		})
		const defaultSettings = BinaryModule.defaultSettings
		const stored =
			persisted?.settings && typeof persisted.settings === 'object'
				? (persisted.settings as Record<string, unknown>)
				: {}
		const merged = { ...defaultSettings, ...stored }

		const placementMode = this._ensureEnum(
			merged.placementMode,
			['auto_weak', 'alternate', 'strict_left', 'strict_right'] as const,
			'auto_weak'
		)
		const spilloverMode = this._ensureEnum(
			merged.spilloverMode,
			['bfs', 'weak_leg_bfs'] as const,
			'weak_leg_bfs'
		)
		const alternateMode = this._ensureEnum(
			merged.alternateMode,
			['by_referrer', 'by_hash'] as const,
			'by_referrer'
		)
		const weakMetric = this._ensureEnum(
			merged.weakMetric,
			['count', 'bv'] as const,
			'count'
		)
		const tieBreaker = this._ensureEnum(
			merged.tieBreaker,
			['left', 'right', 'hash'] as const,
			'hash'
		)
		const maxBfsVisited =
			typeof merged.maxBfsVisited === 'number' && !Number.isNaN(merged.maxBfsVisited)
				? Math.min(Math.max(merged.maxBfsVisited, 100), 500000)
				: 50000

		return {
			placementMode,
			spilloverMode,
			alternateMode,
			weakMetric,
			tieBreaker,
			maxBfsVisited
		}
	}

	private _ensureEnum<T extends readonly string[]>(
		value: unknown,
		allowed: T,
		fallback: T[number]
	) {
		const normalized = typeof value === 'string' ? value : ''
		return (allowed as readonly string[]).includes(normalized)
			? (normalized as T[number])
			: fallback
	}

	private _getSlotOrder(
		node: {
			leftCount: number
			rightCount: number
			leftBvTotal: number
			rightBvTotal: number
			lastAssignLeg: BinaryLeg | null
		},
		settings: {
			placementMode: 'auto_weak' | 'alternate' | 'strict_left' | 'strict_right'
			alternateMode: 'by_referrer' | 'by_hash'
			tieBreaker: 'left' | 'right' | 'hash'
			weakMetric: 'count' | 'bv'
		},
		newUserId: string
	) {
		if (settings.placementMode === 'strict_left') {
			return ['LEFT', 'RIGHT'] as const
		}
		if (settings.placementMode === 'strict_right') {
			return ['RIGHT', 'LEFT'] as const
		}
		if (settings.placementMode === 'alternate') {
			if (settings.alternateMode === 'by_hash') {
				return this._hashOrder(newUserId)
			}
			if (node.lastAssignLeg === 'LEFT') {
				return ['RIGHT', 'LEFT'] as const
			}
			if (node.lastAssignLeg === 'RIGHT') {
				return ['LEFT', 'RIGHT'] as const
			}
			return this._tieBreakerOrder(settings.tieBreaker, newUserId)
		}

		const leftMetric =
			settings.weakMetric === 'bv' ? node.leftBvTotal : node.leftCount
		const rightMetric =
			settings.weakMetric === 'bv' ? node.rightBvTotal : node.rightCount

		if (leftMetric < rightMetric) {
			return ['LEFT', 'RIGHT'] as const
		}
		if (rightMetric < leftMetric) {
			return ['RIGHT', 'LEFT'] as const
		}
		return this._tieBreakerOrder(settings.tieBreaker, newUserId)
	}

	private _getWeakLeg(
		node: { leftCount: number; rightCount: number; leftBvTotal: number; rightBvTotal: number },
		settings: { tieBreaker: 'left' | 'right' | 'hash'; weakMetric: 'count' | 'bv' },
		newUserId: string
	): 'LEFT' | 'RIGHT' {
		const leftMetric =
			settings.weakMetric === 'bv' ? node.leftBvTotal : node.leftCount
		const rightMetric =
			settings.weakMetric === 'bv' ? node.rightBvTotal : node.rightCount
		if (leftMetric < rightMetric) return 'LEFT'
		if (rightMetric < leftMetric) return 'RIGHT'
		return this._tieBreakerOrder(settings.tieBreaker, newUserId)[0]
	}

	private _tieBreakerOrder(
		tieBreaker: 'left' | 'right' | 'hash',
		newUserId: string
	) {
		if (tieBreaker === 'left') return ['LEFT', 'RIGHT'] as const
		if (tieBreaker === 'right') return ['RIGHT', 'LEFT'] as const
		return this._hashOrder(newUserId)
	}

	private _hashOrder(newUserId: string) {
		return newUserId.charCodeAt(0) % 2 === 0
			? (['LEFT', 'RIGHT'] as const)
			: (['RIGHT', 'LEFT'] as const)
	}

	private async _tryPlaceUnderCandidate(
		tx: Prisma.TransactionClient,
		newUserId: string,
		candidateUserId: string,
		order: readonly ('LEFT' | 'RIGHT')[]
	) {
		const children = await tx.mlmBinaryNode.findMany({
			where: { parentUserId: candidateUserId },
			select: { userId: true, leg: true }
		})
		const leftChild = children.find((child) => child.leg === 'LEFT')?.userId
		const rightChild = children.find((child) => child.leg === 'RIGHT')?.userId

		for (const leg of order) {
			const occupied = leg === 'LEFT' ? leftChild : rightChild
			if (occupied) continue

			try {
				await tx.mlmBinaryNode.create({
					data: {
						userId: newUserId,
						parentUserId: candidateUserId,
						leg
					}
				})
				await tx.mlmBinaryNode.update({
					where: { userId: candidateUserId },
					data: { lastAssignLeg: leg }
				})
				return { parentUserId: candidateUserId, leg }
			} catch (error) {
				if (
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === 'P2002'
				) {
					continue
				}
				throw error
			}
		}

		return null
	}

	private async _bfsPlace(
		tx: Prisma.TransactionClient,
		newUserId: string,
		startUserId: string,
		settings: {
			placementMode: 'auto_weak' | 'alternate' | 'strict_left' | 'strict_right'
			alternateMode: 'by_referrer' | 'by_hash'
			tieBreaker: 'left' | 'right' | 'hash'
			weakMetric: 'count' | 'bv'
			maxBfsVisited: number
		}
	) {
		const queue: string[] = [startUserId]
		const visited = new Set<string>()

		while (queue.length > 0) {
			if (visited.size >= settings.maxBfsVisited) {
				throw new Error('Binary placement BFS limit exceeded')
			}

			const candidateUserId = queue.shift()
			if (!candidateUserId || visited.has(candidateUserId)) continue
			visited.add(candidateUserId)

			const candidateNode = await tx.mlmBinaryNode.findUnique({
				where: { userId: candidateUserId },
				select: {
					leftCount: true,
					rightCount: true,
					leftBvTotal: true,
					rightBvTotal: true,
					lastAssignLeg: true
				}
			})
			if (!candidateNode) continue

			const order = this._getSlotOrder(candidateNode, settings, newUserId)
			const placed = await this._tryPlaceUnderCandidate(
				tx,
				newUserId,
				candidateUserId,
				order
			)
			if (placed) {
				return placed
			}

			const leftChild = await this._getChildByLeg(tx, candidateUserId, 'LEFT')
			const rightChild = await this._getChildByLeg(tx, candidateUserId, 'RIGHT')

			for (const leg of order) {
				const childId = leg === 'LEFT' ? leftChild : rightChild
				if (childId) queue.push(childId)
			}
		}

		return null
	}

	private async _getChildByLeg(
		tx: Prisma.TransactionClient,
		parentUserId: string,
		leg: 'LEFT' | 'RIGHT'
	) {
		const child = await tx.mlmBinaryNode.findFirst({
			where: { parentUserId, leg },
			select: { userId: true }
		})
		return child?.userId ?? null
	}

	private async _incrementCountsUpTree(
		tx: Prisma.TransactionClient,
		placementParentUserId: string,
		placementLeg: 'LEFT' | 'RIGHT'
	) {
		let currentUserId: string | null = placementParentUserId
		let currentLeg: 'LEFT' | 'RIGHT' | null = placementLeg

		while (currentUserId && currentLeg) {
			await tx.mlmBinaryNode.update({
				where: { userId: currentUserId },
				data:
					currentLeg === 'LEFT'
						? { leftCount: { increment: 1 } }
						: { rightCount: { increment: 1 } }
			})

			const currentNode = await tx.mlmBinaryNode.findUnique({
				where: { userId: currentUserId },
				select: { parentUserId: true, leg: true }
			})

			if (!currentNode?.parentUserId || !currentNode.leg) break
			currentLeg = currentNode.leg
			currentUserId = currentNode.parentUserId
		}
	}

	private _parseDate(value?: string, endOfDay = false): Date | null {
		if (!value) {
			return null
		}

		const parsed = new Date(value)
		if (isNaN(parsed.getTime())) {
			return null
		}

		if (endOfDay) {
			parsed.setHours(23, 59, 59, 999)
		} else {
			parsed.setHours(0, 0, 0, 0)
		}

		return parsed
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
