import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { SettingsService } from './settings.service'
import { PlansEventsService } from '@/plans/plans-events.service'

const PLAN_SETTINGS_KEYS = new Set([
	'plans.catalog',
	'plans.currency',
	'plans.colors'
])

@Controller('settings')
export class SettingsController {
	constructor(
		private readonly settingsService: SettingsService,
		private readonly plansEventsService: PlansEventsService
	) {}

	@Auth('ADMIN')
	@Get(':key')
	getSetting(@Param('key') key: string) {
		return this.settingsService.getSettingByKey(key)
	}

	@Auth('ADMIN')
	@Post()
	async setSetting(@Body() settingData: { key: string; value: string }) {
		await this.settingsService.setSetting(
			settingData.key,
			settingData.value
		)
		const setting = await this.settingsService.getSettingByKey(settingData.key)
		if (PLAN_SETTINGS_KEYS.has(settingData.key)) {
			this.plansEventsService.emitPlansUpdated()
		}
		return setting
	}
}
