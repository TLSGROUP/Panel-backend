import { isDev } from '@/utils/is-dev.util'
import { ConfigService } from '@nestjs/config'
import type { TransportOptions } from 'nodemailer'

export interface MailConfig {
	transport: TransportOptions
	defaults: {
		from: string
	}
}

export const getMailerConfig = (configService: ConfigService): MailConfig => ({
	transport: {
		host: configService.get<string>('SMTP_SERVER'),
		port: isDev(configService) ? 587 : 465,
		secure: !isDev(configService),
		auth: {
			user: configService.get<string>('SMTP_LOGIN'),
			pass: configService.get<string>('SMTP_PASSWORD')
		}
	},
	defaults: {
		from: '"MLM PANEL" <no-reply@mlmengine.com>'
	}
})
