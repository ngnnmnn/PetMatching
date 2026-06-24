import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng!');
    }

    const payload = { 
      sub: user.id,
      email: user.email, 
      role: user.role,
      name: user.name 
    };
    
    const accessToken = this.jwtService.sign(payload);
    
    // Lưu refresh token (optional)
    // const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    // await this.usersService.updateRefreshToken(user.id, refreshToken);
    
    return {
      success: true,
      message: 'Đăng nhập thành công!',
      accessToken,
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

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.createUser({
      email: registerDto.email,
      password: registerDto.password,
      name: registerDto.name,
      phone: registerDto.phone,
      avatarUrl: registerDto.avatarUrl,
    });

    const payload = { 
      sub: user.id,
      email: user.email, 
      role: user.role,
      name: user.name 
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      success: true,
      message: 'Đăng ký thành công!',
      accessToken,
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

  async verify(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.usersService.findById(decoded.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
          isVerified: user.isVerified,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}