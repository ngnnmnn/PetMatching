"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
const bcrypt = __importStar(require("bcrypt"));
const mail_service_1 = require("../../common/mail/mail.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const users_service_1 = require("../users/users.service");
let AuthService = class AuthService {
    usersService;
    jwtService;
    prisma;
    mailService;
    otpExpiryMs = 5 * 60 * 1000;
    resendCooldownMs = 30 * 1000;
    maxOtpAttempts = 5;
    constructor(usersService, jwtService, prisma, mailService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.prisma = prisma;
        this.mailService = mailService;
    }
    buildAuthResponse(user, message) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
        };
        return {
            success: true,
            message,
            accessToken: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                avatarUrl: user.avatarUrl,
                phone: user.phone,
                isVerified: user.isVerified,
            },
        };
    }
    async login(loginDto) {
        const user = await this.usersService.validateUser(loginDto.email, loginDto.password);
        if (!user) {
            throw new common_1.UnauthorizedException('Email hoặc mật khẩu không đúng!');
        }
        if (!user.isVerified) {
            throw new common_1.UnauthorizedException('Vui lòng xác thực email trước khi đăng nhập.');
        }
        return this.buildAuthResponse(user, 'Đăng nhập thành công!');
    }
    async register(registerDto) {
        await this.usersService.createUser({
            email: registerDto.email,
            password: registerDto.password,
            name: registerDto.name,
            phone: registerDto.phone,
            avatarUrl: registerDto.avatarUrl,
        });
        await this.createAndSendOtp(registerDto.email);
        return {
            success: true,
            message: 'Đăng ký thành công. Vui lòng kiểm tra email để lấy mã OTP.',
            requiresVerification: true,
            email: registerDto.email,
        };
    }
    async verifyEmail(verifyEmailDto) {
        const email = verifyEmailDto.email;
        const latestOtp = await this.prisma.emailOtp.findFirst({
            where: { email },
            orderBy: { createdAt: 'desc' },
        });
        if (!latestOtp) {
            throw new common_1.BadRequestException('Không tìm thấy mã OTP. Vui lòng gửi lại mã.');
        }
        if (latestOtp.usedAt) {
            throw new common_1.BadRequestException('Mã OTP đã được sử dụng.');
        }
        if (latestOtp.expiresAt.getTime() < Date.now()) {
            throw new common_1.BadRequestException('Mã OTP đã hết hạn.');
        }
        if (latestOtp.attempts >= this.maxOtpAttempts) {
            throw new common_1.BadRequestException('Bạn đã nhập sai quá 5 lần. Vui lòng gửi lại mã mới.');
        }
        const isOtpValid = await bcrypt.compare(verifyEmailDto.otp, latestOtp.codeHash);
        if (!isOtpValid) {
            const attempts = latestOtp.attempts + 1;
            await this.prisma.emailOtp.update({
                where: { id: latestOtp.id },
                data: { attempts },
            });
            const remainingAttempts = Math.max(this.maxOtpAttempts - attempts, 0);
            throw new common_1.BadRequestException(`Mã OTP không đúng. Bạn còn ${remainingAttempts} lần thử.`);
        }
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new common_1.BadRequestException('Email chưa được đăng ký.');
        }
        const verifiedUser = await this.prisma.$transaction(async (tx) => {
            await tx.emailOtp.update({
                where: { id: latestOtp.id },
                data: { usedAt: new Date() },
            });
            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: { isVerified: true },
            });
            const { passwordHash, ...result } = updatedUser;
            return result;
        });
        return this.buildAuthResponse(verifiedUser, 'Xác thực email thành công!');
    }
    async resendOtp(resendOtpDto) {
        const user = await this.usersService.findByEmail(resendOtpDto.email);
        if (!user) {
            throw new common_1.BadRequestException('Email chưa được đăng ký.');
        }
        if (user.isVerified) {
            throw new common_1.BadRequestException('Email đã được xác thực.');
        }
        const latestOtp = await this.prisma.emailOtp.findFirst({
            where: { email: resendOtpDto.email },
            orderBy: { lastSentAt: 'desc' },
        });
        if (latestOtp) {
            const elapsedMs = Date.now() - latestOtp.lastSentAt.getTime();
            if (elapsedMs < this.resendCooldownMs) {
                const waitSeconds = Math.ceil((this.resendCooldownMs - elapsedMs) / 1000);
                throw new common_1.BadRequestException(`Vui lòng chờ ${waitSeconds} giây trước khi gửi lại mã.`);
            }
        }
        await this.createAndSendOtp(resendOtpDto.email);
        return {
            success: true,
            message: 'Mã OTP mới đã được gửi đến email của bạn.',
        };
    }
    generateOtp() {
        return (0, crypto_1.randomInt)(0, 1_000_000).toString().padStart(6, '0');
    }
    async createAndSendOtp(email) {
        const otp = this.generateOtp();
        const codeHash = await bcrypt.hash(otp, 10);
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            await tx.emailOtp.updateMany({
                where: { email, usedAt: null },
                data: { usedAt: now },
            });
            await tx.emailOtp.create({
                data: {
                    email,
                    codeHash,
                    expiresAt: new Date(now.getTime() + this.otpExpiryMs),
                    lastSentAt: now,
                },
            });
        });
        await this.mailService.sendOtpEmail(email, otp);
    }
    getGoogleAuthUrl() {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
            throw new common_1.BadRequestException('Missing GOOGLE_CLIENT_ID');
        }
        const redirectUri = process.env.GOOGLE_CALLBACK_URL ||
            'http://localhost:5000/api/auth/google/callback';
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            prompt: 'select_account',
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    async googleLogin(code) {
        if (!code) {
            throw new common_1.BadRequestException('Missing Google authorization code');
        }
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_CALLBACK_URL ||
            'http://localhost:5000/api/auth/google/callback';
        if (!clientId || !clientSecret) {
            throw new common_1.BadRequestException('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
        }
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });
        const tokenData = (await tokenResponse.json());
        if (!tokenResponse.ok || !tokenData.access_token) {
            throw new common_1.BadGatewayException(tokenData.error_description || 'Không thể xác thực với Google');
        }
        const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });
        const googleUser = (await userInfoResponse.json());
        if (!userInfoResponse.ok || !googleUser.email) {
            throw new common_1.BadGatewayException('Không thể lấy thông tin tài khoản Google');
        }
        if (googleUser.email_verified === false) {
            throw new common_1.UnauthorizedException('Email Google chưa được xác minh');
        }
        const existingUser = await this.usersService.findByEmail(googleUser.email);
        const user = existingUser
            ? await this.usersService.updateGoogleProfile(existingUser.id, {
                name: existingUser.name || googleUser.name || googleUser.email,
                avatarUrl: existingUser.avatarUrl || googleUser.picture,
                isVerified: true,
            })
            : await this.usersService.createGoogleUser({
                email: googleUser.email,
                name: googleUser.name || googleUser.email,
                avatarUrl: googleUser.picture,
            });
        return this.buildAuthResponse(user, 'Đăng nhập Google thành công!');
    }
    async verify(token) {
        try {
            const decoded = this.jwtService.verify(token);
            const user = await this.usersService.findById(decoded.sub);
            if (!user) {
                throw new common_1.UnauthorizedException('User not found');
            }
            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    avatarUrl: user.avatarUrl,
                    phone: user.phone,
                    isVerified: user.isVerified,
                },
            };
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid token');
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService,
        prisma_service_1.PrismaService,
        mail_service_1.MailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map