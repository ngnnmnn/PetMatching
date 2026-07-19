import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateResponse(messages: { role: string; content: string }[]) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY is not defined in environment variables');
      throw new InternalServerErrorException('Cấu hình Chatbot chưa hoàn tất (Thiếu API Key).');
    }

    try {
      // 1. Fetch active products to act as chatbot catalog context
      const products = await this.prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          brand: true,
          category: true,
          targetSpecies: true,
          originalPrice: true,
          salePrice: true,
          description: true,
        },
      });

      // 2. Build system instructions
      const systemInstruction = `
Bạn là Trợ lý Ảo PetMatch (PetMatch Assistant), một chuyên gia tư vấn sản phẩm và dịch vụ chăm sóc thú cưng thân thiện, chu đáo và nhiệt tình của cửa hàng PetMatch.
Nhiệm vụ của bạn là:
1. Trò chuyện, giải đáp thắc mắc và tư vấn cho khách hàng về cách chăm sóc thú cưng (chó, mèo, dinh dưỡng, đồ chơi, tắm rửa, cắt tỉa v.v.).
2. Dựa vào nhu cầu của khách hàng, hãy nhiệt tình tư vấn và giới thiệu các sản phẩm phù hợp nhất từ danh sách sản phẩm của cửa hàng dưới đây.
3. Khi giới thiệu sản phẩm, bạn bắt buộc (MUST) chèn liên kết dạng markdown đến trang sản phẩm theo đúng định dạng: [Tên sản phẩm](/home/product/id-sản-phẩm). Ví dụ: "Bạn có thể tham khảo [Bát ăn tự động PUKY](/home/product/bat-an-tu-dong-puky-id) rất tiện lợi...".
4. ĐỒNG THỜI, để hệ thống hiển thị danh sách các sản phẩm đề xuất dưới dạng khung thẻ (cards) đẹp mắt trong khung chat, ở cuối câu trả lời của bạn, bạn PHẢI đính kèm thêm dòng thông tin danh sách ID sản phẩm được đề xuất với định dạng chính xác sau (không chứa dấu cách thừa ở thẻ đóng/mở):
\`[RECOMMENDATIONS: id1, id2]\`
Ví dụ: Nếu đề xuất sản phẩm A (id: 1a2b) và sản phẩm B (id: 3c4d), hãy thêm ở cuối câu trả lời:
\`[RECOMMENDATIONS: 1a2b, 3c4d]\`
Nếu cuộc hội thoại bình thường không đề xuất bất kỳ sản phẩm cụ thể nào, vui lòng KHÔNG thêm dòng này.

Dưới đây là danh sách sản phẩm hiện có tại cửa hàng PetMatch:
${JSON.stringify(products, null, 2)}

Hãy luôn trả lời bằng Tiếng Việt một cách tự nhiên, lịch sự, ngắn gọn và hữu ích nhất. Chào mừng khách hàng nhiệt tình khi bắt đầu.
`;

      // 3. Format chat history for Gemini API (roles: user, model)
      const formattedContents = messages.map((msg) => {
        const role = msg.role === 'user' ? 'user' : 'model';
        return {
          role,
          parts: [{ text: msg.content }],
        };
      });

      // 4. Send request to Gemini API
      const modelName = 'gemini-flash-latest';
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const payload = {
        contents: formattedContents,
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Gemini API returned status ${response.status}: ${errorText}`);
        throw new InternalServerErrorException('Gặp lỗi khi kết nối với máy chủ AI.');
      }

      const data = await response.json();
      
      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!replyText) {
        this.logger.error(`Invalid Gemini response format: ${JSON.stringify(data)}`);
        throw new InternalServerErrorException('Không nhận được phản hồi hợp lệ từ AI.');
      }

      return {
        text: replyText,
      };
    } catch (error) {
      this.logger.error(`Error in ChatService: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message || 'Lỗi xử lý chatbot.');
    }
  }
}
