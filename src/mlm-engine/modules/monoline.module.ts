import { MlmModuleDefinition } from '../mlm-engine.types'

export const MonolineModule: MlmModuleDefinition = {
	key: 'monoline',
	label: 'Monoline',
	description: 'Single line (snake) structure.',
	defaultSettings: {
		bonusPercent: 3
	},
	schema: [
		{
			key: 'bonusPercent',
			label: 'Bonus percent',
			type: 'number',
			required: true,
			min: 0,
			max: 100
		}
	]
}
