import { MlmModuleDefinition } from '../mlm-engine.types'

export const BinaryModule: MlmModuleDefinition = {
	key: 'binary',
	label: 'Binary',
	description: 'Left/right leg matching.',
	defaultSettings: {
		matchPercent: 10,
		flushOut: false
	},
	schema: [
		{
			key: 'matchPercent',
			label: 'Match percent',
			type: 'number',
			required: true,
			min: 0,
			max: 100
		},
		{
			key: 'flushOut',
			label: 'Flush out',
			type: 'checkbox'
		}
	]
}
