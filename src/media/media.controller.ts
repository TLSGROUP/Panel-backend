import {
	BadRequestException,
	Controller,
	Get,
	HttpCode,
	NotFoundException,
	Post,
	Query,
	Res,
	UploadedFiles,
	UseInterceptors,
	UsePipes,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { path } from 'app-root-path'
import { existsSync } from 'fs'
import { basename, join } from 'path'
import type { Response } from 'express'
import { Auth } from '@/auth/decorators/auth.decorator'
import { IFile } from './media.interface'
import { MediaService } from './media.service'
import { FileValidationPipe } from './pipes/file.validation.pipe'
import { FolderValidationPipe } from './pipes/folder.validation.pipe'

@Controller('media')
export class MediaController {
	constructor(private readonly mediaService: MediaService) {}

	@HttpCode(200)
	@Post()
	@UseInterceptors(FilesInterceptor('media'))
	@UsePipes(new FolderValidationPipe())
	async uploadMediaFile(
		@UploadedFiles(FileValidationPipe) mediaFiles: IFile | IFile[],
		@Query('folder') folder?: string
	) {
		return this.mediaService.saveMedia(mediaFiles, folder)
	}

	@Get('download')
	@Auth()
	async downloadMediaFile(
		@Res() res: Response,
		@Query('path') filePath?: string
	) {
		if (!filePath) {
			throw new BadRequestException('File path is required')
		}

		if (!filePath.startsWith('/uploads/')) {
			throw new BadRequestException('Invalid file path')
		}

		const relativePath = filePath.replace(/^\/uploads\//, '')
		if (!relativePath || relativePath.includes('..')) {
			throw new BadRequestException('Invalid file path')
		}

		const absolutePath = join(path, 'uploads', relativePath)
		if (!existsSync(absolutePath)) {
			throw new NotFoundException('File not found')
		}

		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${basename(absolutePath)}"`
		)
		return res.sendFile(absolutePath)
	}
}
