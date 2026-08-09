import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private createMailer() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure =
      process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE === 'true'
        : port === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;

    if (!host || !user || !pass || !from) {
      return null;
    }

    return {
      from,
      transporter: nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        tls: {
          rejectUnauthorized: false,
        },
      }),
    };
  }

  async sendOtpEmail(email: string, otp: string) {
    const mailer = this.createMailer();
    if (!mailer) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(
          `SMTP is not configured. Development OTP for ${email}: ${otp}`,
        );
        return;
      }

      throw new BadGatewayException(
        'Chưa cấu hình biến môi trường SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM) trên server deploy.',
      );
    }

    try {
      await mailer.transporter.sendMail({
        from: mailer.from,
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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Lỗi gửi email OTP tới ${email}: ${errorMessage}`);
      throw new BadGatewayException(
        `Không thể gửi email OTP (${errorMessage}). Vui lòng kiểm tra cấu hình SMTP server.`,
      );
    }
  }

  async sendPasswordResetEmail(email: string, resetUrl: string) {
    const mailer = this.createMailer();
    if (!mailer) {
      throw new BadGatewayException(
        'Chưa cấu hình SMTP để gửi email đặt lại mật khẩu.',
      );
    }

    await mailer.transporter.sendMail({
      from: mailer.from,
      to: email,
      subject: 'Đặt lại mật khẩu PetMatching',
      text: [
        'Bạn đã yêu cầu đặt lại mật khẩu PetMatching.',
        `Mở liên kết sau để đặt mật khẩu mới: ${resetUrl}`,
        'Liên kết này sẽ hết hạn sau 15 phút và chỉ sử dụng được một lần.',
        'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.',
      ].join('\n\n'),
      html: `
        <div style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e45d1c;">Đặt lại mật khẩu PetMatching</h2>
          <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản PetMatching.</p>
          <p style="margin: 28px 0;">
            <a href="${resetUrl}" style="display: inline-block; border-radius: 10px; background: #e45d1c; color: #ffffff; padding: 12px 22px; font-weight: 700; text-decoration: none;">
              Đặt lại mật khẩu
            </a>
          </p>
          <p>Nếu nút trên không hoạt động, hãy sao chép liên kết sau vào trình duyệt:</p>
          <p style="overflow-wrap: anywhere;"><a href="${resetUrl}">${resetUrl}</a></p>
          <p>Liên kết này sẽ hết hạn sau <strong>15 phút</strong> và chỉ sử dụng được một lần.</p>
          <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
        </div>
      `,
    });
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
