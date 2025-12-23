import { MlmModuleDefinition } from '../mlm-engine.types'

export const MatrixModule: MlmModuleDefinition = {
	key: 'matrix',
	label: 'Matrix',
	description: 'Forced matrix with fixed width and depth.',
	defaultSettings: {
		width: 3,
		depth: 5
	},
	schema: [
		{
			key: 'width',
			label: 'Width',
			type: 'number',
			required: true,
			min: 2,
			max: 10
		},
		{
			key: 'depth',
			label: 'Depth',
			type: 'number',
			required: true,
			min: 1,
			max: 20
		}
	]
}
