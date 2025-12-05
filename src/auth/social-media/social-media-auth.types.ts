import type { UserModel as User } from 'prisma/generated/models'

export interface IGoogleProfile {
	id: string
	displayName: string
	name: {
		familyName: string
		givenName: string
	}
	emails: Array<{
		value: string
		verified: boolean
	}>
	photos: Array<{
		value: string
	}>
}

export type TUserSocial = Partial<
	Pick<User, 'email' | 'name' | 'avatarPath'>
>

export type TSocialCallback = (
	error: any,
	user: TUserSocial,
	info?: any
) => void
