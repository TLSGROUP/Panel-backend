import { config as loadEnv } from 'dotenv'
import { defineConfig, env } from '@prisma/config'

loadEnv()

export default defineConfig({
	datasource: {
		url: env('DATABASE_URL'),
	},
	schema: './prisma/schema.prisma',
})
