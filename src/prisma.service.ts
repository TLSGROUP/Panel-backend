import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../prisma/generated/client'
import { Pool } from 'pg'

@Injectable()
export class PrismaService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	private readonly pool: Pool

	constructor(private readonly configService: ConfigService) {
		const connectionString =
			configService.get<string>('DATABASE_URL') ?? process.env.DATABASE_URL

		if (!connectionString) {
			throw new Error('DATABASE_URL environment variable is not defined')
		}

		const pool = new Pool({ connectionString })
		super({
			adapter: new PrismaPg(pool),
		})

		this.pool = pool
	}

	async onModuleInit() {
		await this.$connect()
	}

	async onModuleDestroy() {
		await this.$disconnect()
		await this.pool.end()
	}
}
