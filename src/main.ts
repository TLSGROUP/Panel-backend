import { RequestMethod } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { raw } from 'express'
import * as cookieParser from 'cookie-parser'
import { AppModule } from './app.module'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule)

	// Serve static files from uploads directory
	app.useStaticAssets(join(__dirname, '..', 'uploads'), {
		prefix: '/uploads/',
	})

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
	const corsOriginSet = new Set(corsOrigins)

	app.enableCors({
		origin: (origin, callback) => {
			if (!origin) {
				return callback(null, true)
			}

			if (corsOriginSet.has(origin)) {
				return callback(null, true)
			}

			return callback(null, false)
		},
		credentials: true,
		exposedHeaders: 'set-cookie'
	})

	await app.listen(4200)
}
bootstrap()
