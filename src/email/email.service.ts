import VerificationEmail from '@email/confirmation.email'
import PasswordResetEmail from '@email/password-reset.email'
import {
	DEFAULT_LANGUAGE,
	type Language
} from '@/language/language.constants'
import { MailerService } from '@nestjs-modules/mailer'
import { Injectable } from '@nestjs/common'
import { render } from '@react-email/render'

const verificationSubjects: Record<Language, string> = {
	en: 'Confirm your email',
	de: 'Bestätige deine E-Mail'
}

const passwordResetSubjects: Record<Language, string> = {
	en: 'Password reset',
	de: 'Passwort zurücksetzen'
}

@Injectable()
export class EmailService {
	constructor(private readonly mailerService: MailerService) {}

	sendEmail(to: string, subject: string, html: string) {
		return this.mailerService.sendMail({
			to,
			subject,
			html
		})
	}

	async sendVerification(
		to: string,
		verificationLink: string,
		language: Language = DEFAULT_LANGUAGE
	) {
		const subject =
			verificationSubjects[language] ?? verificationSubjects[DEFAULT_LANGUAGE]
		const html = await render(
			VerificationEmail({ url: verificationLink, language })
		)
		return this.sendEmail(to, subject, html)
	}

	async sendPasswordResetCode(
		to: string,
		code: string,
		language: Language = DEFAULT_LANGUAGE
	) {
		const subject =
			passwordResetSubjects[language] ?? passwordResetSubjects[DEFAULT_LANGUAGE]
		const html = await render(PasswordResetEmail({ code, language }))
		return this.sendEmail(to, subject, html)
	}
}
