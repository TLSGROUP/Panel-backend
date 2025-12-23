import { MlmModuleDefinition } from '../mlm-engine.types'

export const GenerationalModule: MlmModuleDefinition = {
	key: 'generational',
	label: 'Generational',
	description: 'Bonus based on generations.',
	defaultSettings: {
		generations: 3,
		bonusPercent: 4
	},
	schema: [
		{
			key: 'generations',
			label: 'Generations',
			type: 'number',
			required: true,
			min: 1,
			max: 10
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
