import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Auth } from '@/auth/decorators/auth.decorator'
import { MlmEngineService } from './mlm-engine.service'
import type { MlmSettingValue } from './mlm-engine.types'

@Controller('mlm-engine')
export class MlmEngineController {
	constructor(private readonly mlmEngineService: MlmEngineService) {}

	@Auth('ADMIN')
	@Get('modules')
	getModules() {
		return this.mlmEngineService.getAvailableModules()
	}

	@Auth()
	@Get('enabled')
	getEnabledModules() {
		return this.mlmEngineService.getEnabledModuleKeys()
	}

	@Auth()
	@Get('modules/:key')
	getModuleSettings(@Param('key') key: string) {
		return this.mlmEngineService.getModuleSettingsByKey(key)
	}

	@Auth('ADMIN')
	@Post('modules/settings')
	saveModuleSettings(
		@Body() payload: { key: string; settings: Record<string, MlmSettingValue> }
	) {
		return this.mlmEngineService.saveModuleSettings(payload.key, payload.settings ?? {})
	}
}
