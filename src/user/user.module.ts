import { EmailModule } from '@/email/email.module'
import { PrismaService } from '@/prisma.service'
import { Module } from '@nestjs/common'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
	imports: [EmailModule],
	controllers: [UserController],
	providers: [UserService, PrismaService],
	exports: [UserService]
})
export class UserModule {}
