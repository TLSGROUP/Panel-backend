import { Injectable } from '@nestjs/common'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

import { Setting } from 'prisma/generated/client'
import { PrismaService } from 'src/prisma.service'

@Injectable()
export class SettingsService {
	constructor(private prisma: PrismaService) {}

	private readonly protectedKeys = new Set([
		'stripe.secret_key',
		'stripe.public_key',
		'stripe.webhook_secret'
	])

	async getSettingByKey(key: string): Promise<Setting | null> {
		const setting = await this.prisma.setting.findUnique({
			where: { key },
		})
		if (!setting) return null

		if (this.protectedKeys.has(key)) {
			const decrypted = this.decryptIfNeeded(setting.value)
			return { ...setting, value: this.maskValue(decrypted) }
		}

		return setting
	}

	async getSettingValue(key: string): Promise<string | null> {
		const setting = await this.prisma.setting.findUnique({
			where: { key },
		})
		if (!setting?.value) return null

		if (this.protectedKeys.has(key)) {
			return this.decryptIfNeeded(setting.value)
		}

		return setting.value
	}

	async setSetting(key: string, value: string): Promise<Setting> {
		if (this.protectedKeys.has(key)) {
			if (this.looksMasked(value)) {
				const existing = await this.prisma.setting.findUnique({ where: { key } })
				if (!existing) {
					throw new Error('Cannot keep masked value without existing setting')
				}
				return existing
			}

			const encrypted = this.encryptValue(value)
			return this.prisma.setting.upsert({
				where: { key },
				update: { value: encrypted },
				create: { key, value: encrypted },
			})
		}

		return this.prisma.setting.upsert({
			where: { key },
			update: { value },
			create: { key, value },
		})
	}

	private getEncryptionKey(): Buffer {
		const secret = process.env.SETTINGS_ENCRYPTION_KEY || ''

		if (!secret) {
			throw new Error('SETTINGS_ENCRYPTION_KEY is not configured')
		}

		return createHash('sha256').update(secret).digest()
	}

	private encryptValue(value: string): string {
		const key = this.getEncryptionKey()
		const iv = randomBytes(12)
		const cipher = createCipheriv('aes-256-gcm', key, iv)
		const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
		const tag = cipher.getAuthTag()
		return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
	}

	private decryptIfNeeded(value: string): string {
		if (!value.startsWith('enc:')) return value

		const [, ivB64, tagB64, dataB64] = value.split(':')
		if (!ivB64 || !tagB64 || !dataB64) return value

		const key = this.getEncryptionKey()
		const iv = Buffer.from(ivB64, 'base64')
		const tag = Buffer.from(tagB64, 'base64')
		const data = Buffer.from(dataB64, 'base64')
		const decipher = createDecipheriv('aes-256-gcm', key, iv)
		decipher.setAuthTag(tag)
		const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
		return decrypted.toString('utf8')
	}

	private maskValue(value: string): string {
		if (!value) return ''
		if (value.length <= 8) return '••••'
		return `${value.slice(0, 6)}••••${value.slice(-4)}`
	}

	private looksMasked(value: string): boolean {
		return value.includes('•') || value.includes('****')
	}
}
