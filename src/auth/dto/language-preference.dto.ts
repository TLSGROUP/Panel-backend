import { IsIn } from 'class-validator'
import {
	SUPPORTED_LANGUAGES,
	type Language
} from '@/language/language.constants'

export class LanguagePreferenceDto {
	@IsIn(SUPPORTED_LANGUAGES)
	language: Language
}
