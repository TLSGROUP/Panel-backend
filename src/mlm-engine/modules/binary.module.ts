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
		minPersonalShareInWeakLeg: 30,
		placementMode: 'auto_weak',
		spilloverMode: 'weak_leg_bfs',
		alternateMode: 'by_referrer',
		weakMetric: 'count',
		tieBreaker: 'hash',
		maxBfsVisited: 50000
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
			key: 'placementMode',
			label: 'Placement mode',
			type: 'select',
			options: [
				{ label: 'Auto weak', value: 'auto_weak' },
				{ label: 'Alternate', value: 'alternate' },
				{ label: 'Strict left', value: 'strict_left' },
				{ label: 'Strict right', value: 'strict_right' }
			]
		},
		{
			key: 'spilloverMode',
			label: 'Spillover mode',
			type: 'select',
			options: [
				{ label: 'BFS (level-by-level)', value: 'bfs' },
				{ label: 'Weak leg first', value: 'weak_leg_bfs' }
			]
		},
		{
			key: 'alternateMode',
			label: 'Alternate mode',
			type: 'select',
			options: [
				{ label: 'By sponsor history', value: 'by_referrer' },
				{ label: 'Stable automatic', value: 'by_hash' }
			]
		},
		{
			key: 'weakMetric',
			label: 'Weak metric',
			type: 'select',
			options: [
				{ label: 'Count', value: 'count' },
				{ label: 'BV (Business Volume)', value: 'bv' }
			]
		},
		{
			key: 'tieBreaker',
			label: 'Tie breaker',
			type: 'select',
			options: [
				{ label: 'Left', value: 'left' },
				{ label: 'Right', value: 'right' },
				{ label: 'Stable automatic', value: 'hash' }
			]
		},
		{
			key: 'maxBfsVisited',
			label: 'Max BFS visited',
			type: 'number',
			required: true,
			min: 100,
			max: 500000
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
