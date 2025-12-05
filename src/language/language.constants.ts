export const SUPPORTED_LANGUAGES = ['en', 'de'] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'en'

export const LANGUAGE_COOKIE_NAME = 'preferred_language'
export const LANGUAGE_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 365 // 1 year

export const isLanguage = (value: unknown): value is Language =>
	SUPPORTED_LANGUAGES.includes(value as Language)

export const normalizeLanguage = (value?: string | null): Language =>
	(isLanguage(value) ? value : DEFAULT_LANGUAGE)
