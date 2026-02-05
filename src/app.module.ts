import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { GoogleRecaptchaModule } from '@nestlab/google-recaptcha'
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
			isGlobal: true
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
