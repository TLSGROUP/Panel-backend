import { RequestMethod } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { raw } from 'express'
import * as cookieParser from 'cookie-parser'
import { AppModule } from './app.module'

async function bootstrap() {
	const app = await NestFactory.create(AppModule)

	app.setGlobalPrefix('api', {
		exclude: [
			{ path: 'auth/google', method: RequestMethod.GET },
			{ path: 'auth/google/redirect', method: RequestMethod.GET },
			{ path: 'verify-email', method: RequestMethod.GET }
		]
	})

	app.use(cookieParser())
	app.use('/api/payments/webhook', raw({ type: 'application/json' }))
	const corsOrigins = (process.env.CLIENT_APP_URL ||
		'http://localhost:3000,http://127.0.0.1:3000')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean)
	app.enableCors({
		origin: corsOrigins,
		credentials: true,
		exposedHeaders: 'set-cookie'
	})

	await app.listen(4200)
}
bootstrap()
