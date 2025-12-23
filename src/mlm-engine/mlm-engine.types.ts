export type MlmFieldType = 'text' | 'number' | 'select' | 'checkbox'

export type MlmSettingValue =
	| string
	| number
	| boolean
	| MlmSettingValue[]
	| { [key: string]: MlmSettingValue }

export type MlmFieldSchema = {
	key: string
	label: string
	type: MlmFieldType
	required?: boolean
	placeholder?: string
	options?: { label: string; value: string }[]
	min?: number
	max?: number
}

export type MlmModuleSchema = {
	key: string
	label: string
	description?: string
	fields: MlmFieldSchema[]
}

export type MlmModuleDefinition = {
	key: string
	label: string
	description?: string
	defaultSettings: Record<string, MlmSettingValue>
	schema: MlmFieldSchema[]
}
