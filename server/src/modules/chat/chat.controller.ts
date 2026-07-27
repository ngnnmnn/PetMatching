import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatDto } from './dto/chat.dto';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async chat(@Req() req: any, @Body() dto: ChatDto) {
    const userId = req.user?.id || null;
    return this.chatService.generateResponse(dto.messages, userId);
  }
}
