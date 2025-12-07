import VerificationEmail from '@email/confirmation.email'
import PasswordResetEmail from '@email/password-reset.email'
import {
	DEFAULT_LANGUAGE,
	type Language
} from '@/language/language.constants'
import { Injectable, Inject } from '@nestjs/common'
import { render } from '@react-email/render'
import type { Transporter } from 'nodemailer'
import {
	MAIL_DEFAULT_FROM,
	MAIL_TRANSPORTER
} from './email.constants'

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
	constructor(
		@Inject(MAIL_TRANSPORTER)
		private readonly mailTransporter: Transporter,
		@Inject(MAIL_DEFAULT_FROM)
		private readonly defaultFrom: string
	) {}

	sendEmail(to: string, subject: string, html: string) {
		return this.mailTransporter.sendMail({
			from: this.defaultFrom,
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
