import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'
import { getMailerConfig, type MailConfig } from '@/config/mailer.config'
import {
	MAIL_CONFIG,
	MAIL_DEFAULT_FROM,
	MAIL_TRANSPORTER
} from './email.constants'
import { EmailService } from './email.service'

@Module({
	imports: [
		ConfigModule
	],
	providers: [
		{
			provide: MAIL_CONFIG,
			useFactory: getMailerConfig,
			inject: [ConfigService]
		},
		{
			provide: MAIL_TRANSPORTER,
			useFactory: (config: MailConfig) =>
				nodemailer.createTransport(config.transport),
			inject: [MAIL_CONFIG]
		},
		{
			provide: MAIL_DEFAULT_FROM,
			useFactory: (config: MailConfig) => config.defaults.from,
			inject: [MAIL_CONFIG]
		},
		EmailService
	],
	exports: [EmailService]
})
export class EmailModule {}
