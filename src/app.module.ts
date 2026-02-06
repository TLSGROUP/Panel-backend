import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { GoogleRecaptchaModule } from '@nestlab/google-recaptcha'
import * as Joi from 'joi'
import { AuthModule } from './auth/auth.module'
import { getGoogleRecaptchaConfig } from './config/google-recaptcha.config'
import { UserModule } from './user/user.module'
import { StatisticsModule } from './statistics/statistics.module'
import { SettingsModule } from './settings/settings.module'
import { MediaModule } from './media/media.module'
import { PaymentsModule } from './payments/payments.module'
import { MlmEngineModule } from './mlm-engine/mlm-engine.module'
import { WalletModule } from './wallet/wallet.module'
import { WithdrawalsModule } from './withdrawals/withdrawals.module'

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			validationSchema: Joi.object({
				MODE: Joi.string().valid('development', 'production', 'test').optional(),
				NODE_ENV: Joi.string()
					.valid('development', 'production', 'test')
					.optional(),
				DATABASE_URL: Joi.string().required(),
				JWT_SECRET: Joi.string().required(),
				RECAPTCHA_SECRET_KEY: Joi.string().required(),
				SMTP_PASSWORD: Joi.string().required(),
				SMTP_SERVER: Joi.string().required(),
				SMTP_LOGIN: Joi.string().required(),
				GOOGLE_CLIENT_ID: Joi.string().required(),
				GOOGLE_CLIENT_SECRET: Joi.string().required(),
				GOOGLE_CALLBACK_URL: Joi.string().uri().required(),
				SETTINGS_ENCRYPTION_KEY: Joi.string().required(),
				MLM_ENABLED: Joi.string().optional(),
				BACKEND_PUBLIC_URL: Joi.string().uri().required(),
				CLIENT_APP_URL: Joi.string().uri().required(),
				COOKIE_DOMAIN: Joi.string().required(),
				COOKIE_SECURE: Joi.string().valid('true', 'false').required(),
				COOKIE_SAMESITE: Joi.string()
					.valid('lax', 'strict', 'none')
					.required()
			}).unknown(true)
		}),
		GoogleRecaptchaModule.forRootAsync({
			imports: [ConfigModule],
			useFactory: getGoogleRecaptchaConfig,
			inject: [ConfigService]
		}),
		AuthModule,
		UserModule,
		StatisticsModule,
		SettingsModule,
		MediaModule,
		PaymentsModule,
		MlmEngineModule,
		WalletModule,
		WithdrawalsModule
	]
})
export class AppModule {}
