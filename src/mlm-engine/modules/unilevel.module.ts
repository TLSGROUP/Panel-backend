import { MlmModuleDefinition } from '../mlm-engine.types'

export const UniLevelModule: MlmModuleDefinition = {
	key: 'unilevel',
	label: 'UniLevel',
	description: 'Linear payout by depth levels.',
	defaultSettings: {
		planLevels: {}
	},
	schema: []
}
