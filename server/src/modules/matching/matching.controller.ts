import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import { CreateMatchingRequestDto } from './dto/create-matching-request.dto';
import { EndMatchDto } from './dto/end-match.dto';
import { GetCandidatesDto } from './dto/get-candidates.dto';
import { PassPetDto } from './dto/pass-pet.dto';
import { ReportMatchDto } from './dto/report-match.dto';
import { SendMatchMessageDto } from './dto/send-match-message.dto';
import { MatchingService } from './matching.service';

const matchingImageUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(
        new BadRequestException('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};

@UseGuards(JwtAuthGuard)
@Controller('api/matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get('candidates')
  getCandidates(
    @Req() request: AuthenticatedRequest,
    @Query() dto: GetCandidatesDto,
  ) {
    return this.matchingService.getCandidates(request.user.id, dto);
  }

  @Post('pass')
  passPet(@Req() request: AuthenticatedRequest, @Body() dto: PassPetDto) {
    return this.matchingService.passPet(request.user.id, dto);
  }

  /**
   * Khôi phục (reset) toàn bộ các ứng viên đã từng bấm Bỏ qua (Pass) của thú cưng cái
   * Giúp danh sách ứng viên hiển thị trở lại khi người dùng lướt hết thẻ
   */
  @Delete('pass/:femalePetId')
  resetPassedPets(
    @Req() request: AuthenticatedRequest,
    @Param('femalePetId') femalePetId: string,
  ) {
    return this.matchingService.resetPassedPets(
      request.user.id,
      femalePetId,
    );
  }

  @Post('requests')
  createRequest(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateMatchingRequestDto,
  ) {
    return this.matchingService.createRequest(request.user.id, dto);
  }

  @Get('requests/incoming')
  getIncomingRequests(@Req() request: AuthenticatedRequest) {
    return this.matchingService.getIncomingRequests(request.user.id);
  }

  @Get('requests/outgoing')
  getOutgoingRequests(@Req() request: AuthenticatedRequest) {
    return this.matchingService.getOutgoingRequests(request.user.id);
  }

  @Post('requests/:id/accept')
  acceptRequest(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.matchingService.acceptRequest(request.user.id, id);
  }

  @Post('requests/:id/reject')
  rejectRequest(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.matchingService.rejectRequest(request.user.id, id);
  }

  /**
   * Hủy yêu cầu ghép đôi do chính mình gửi đi (chỉ thực hiện khi yêu cầu đang ở trạng thái PENDING)
   */
  @Post('requests/:id/cancel')
  cancelRequest(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.matchingService.cancelRequest(request.user.id, id);
  }

  @Get('matches')
  getMatches(@Req() request: AuthenticatedRequest) {
    return this.matchingService.getMatches(request.user.id);
  }

  @Post('matches/:id/report')
  @UseInterceptors(FilesInterceptor('images', 3, matchingImageUploadOptions))
  reportMatch(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReportMatchDto,
    @UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string }> = [],
  ) {
    return this.matchingService.reportMatch(request.user.id, id, dto, files);
  }

  @Post('matches/:id/block')
  blockMatchUser(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.matchingService.blockMatchUser(request.user.id, id);
  }

  @Get('blocks')
  getBlockedUsers(@Req() request: AuthenticatedRequest) {
    return this.matchingService.getBlockedUsers(request.user.id);
  }

  @Delete('blocks/:userId')
  unblockUser(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    return this.matchingService.unblockUser(request.user.id, userId);
  }

  @Post('matches/:id/end')
  endMatch(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: EndMatchDto,
  ) {
    return this.matchingService.endMatch(request.user.id, id, dto);
  }

  @Get('matches/:id/messages')
  getMessages(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.matchingService.getMessages(request.user.id, id);
  }

  @Post('matches/:id/messages')
  sendMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SendMatchMessageDto,
  ) {
    return this.matchingService.sendMessage(request.user.id, id, dto.content);
  }

  @Post('matches/:id/messages/image')
  @UseInterceptors(FileInterceptor('file', matchingImageUploadOptions))
  sendImageMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
    @Body('content') content?: string,
  ) {
    if (!file) throw new BadRequestException('Không tìm thấy ảnh để tải lên.');
    return this.matchingService.sendImageMessage(
      request.user.id,
      id,
      file,
      content,
    );
  }
}
