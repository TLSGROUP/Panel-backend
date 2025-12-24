import { MlmModuleDefinition } from '../mlm-engine.types'

export const BinaryModule: MlmModuleDefinition = {
	key: 'binary',
	label: 'Binary',
	description: 'Left/right leg matching.',
	defaultSettings: {
		pairVolume: 50,
		pairPercent: 10,
		carryoverMaxRatio: 3,
		requirePersonalsInEachLeg: true,
		minActivePersonals: 2,
		minWeakLegBvPerDay: 50,
		dailyBinaryCap: 1000,
		weeklyBinaryCap: 5000,
		maxPercentFromOneLegForRank: 40,
		trackPersonalVsSpillover: true,
		minPersonalShareInWeakLeg: 30
	},
	schema: [
		{
			key: 'pairVolume',
			label: 'Pair volume (BV)',
			type: 'number',
			required: true,
			min: 1
		},
		{
			key: 'pairPercent',
			label: 'Pair percent',
			type: 'number',
			required: true,
			min: 0,
			max: 100
		},
		{
			key: 'carryoverMaxRatio',
			label: 'Carryover max ratio',
			type: 'number',
			required: true,
			min: 1
		},
		{
			key: 'requirePersonalsInEachLeg',
			label: 'Require personals in each leg',
			type: 'checkbox'
		},
		{
			key: 'minActivePersonals',
			label: 'Minimum active personals',
			type: 'number',
			required: true,
			min: 0
		},
		{
			key: 'minWeakLegBvPerDay',
			label: 'Min weak leg BV per day',
			type: 'number',
			required: true,
			min: 0
		},
		{
			key: 'dailyBinaryCap',
			label: 'Daily binary cap',
			type: 'number',
			required: true,
			min: 0
		},
		{
			key: 'weeklyBinaryCap',
			label: 'Weekly binary cap',
			type: 'number',
			required: true,
			min: 0
		},
		{
			key: 'maxPercentFromOneLegForRank',
			label: 'Max percent from one leg for rank',
			type: 'number',
			required: true,
			min: 0,
			max: 100
		},
		{
			key: 'trackPersonalVsSpillover',
			label: 'Track personal vs spillover',
			type: 'checkbox'
		},
		{
			key: 'minPersonalShareInWeakLeg',
			label: 'Min personal share in weak leg (%)',
			type: 'number',
			required: true,
			min: 0,
			max: 100
		}
	]
}
