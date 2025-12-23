import { BinaryModule } from './modules/binary.module'
import { GenerationalModule } from './modules/generational.module'
import { MatrixModule } from './modules/matrix.module'
import { MonolineModule } from './modules/monoline.module'
import { StairStepModule } from './modules/stair-step.module'
import { UniLevelModule } from './modules/unilevel.module'
import type { MlmModuleDefinition } from './mlm-engine.types'

export const MLM_MODULES: MlmModuleDefinition[] = [
	UniLevelModule,
	BinaryModule,
	MatrixModule,
	StairStepModule,
	GenerationalModule,
	MonolineModule
]
