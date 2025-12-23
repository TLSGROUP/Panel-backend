import { MlmModuleDefinition } from '../mlm-engine.types'

export const StairStepModule: MlmModuleDefinition = {
	key: 'stair-step',
	label: 'Stair-Step / Breakaway',
	description: 'Breakaway with personal and group volume.',
	defaultSettings: {
		qualifyVolume: 1000,
		bonusPercent: 7
	},
	schema: [
		{
			key: 'qualifyVolume',
			label: 'Qualify volume',
			type: 'number',
			required: true,
			min: 0
		},
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
