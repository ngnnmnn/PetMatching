import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendOtpEmail(email: string, otp: string) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;

    if (!host || !user || !pass || !from) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(
          `SMTP is not configured. Development OTP for ${email}: ${otp}`,
        );
        return;
      }

      throw new BadGatewayException('Chưa cấu hình SMTP để gửi email OTP.');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Mã xác thực PetMatching',
      text: `Mã OTP của bạn là ${otp}. Mã này hết hạn sau 5 phút.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.6;">
          <h2>Mã xác thực PetMatching</h2>
          <p>Mã OTP 6 số của bạn là:</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${otp}</p>
          <p>Mã này hết hạn sau 5 phút. Vui lòng không chia sẻ mã với bất kỳ ai.</p>
        </div>
      `,
    });
  }
}
