import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.validateUser(
      loginDto.username,
      loginDto.password,
    );
    
    if (!user) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng!');
    }

    const payload = { 
      id: user.id, 
      username: user.username, 
      role: user.role,
      displayName: user.displayName 
    };
    
    return {
      success: true,
      message: 'Đăng nhập thành công!',
      token: this.jwtService.sign(payload),
      user: payload,
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByUsername(
      registerDto.username,
    );
    
    if (existingUser) {
      throw new ConflictException('Tên đăng nhập đã tồn tại!');
    }

    const newUser = await this.usersService.createUser(
      registerDto.username,
      registerDto.password,
      registerDto.displayName,
    );

    const payload = { 
      id: newUser.id, 
      username: newUser.username, 
      role: newUser.role,
      displayName: newUser.displayName 
    };

    return {
      success: true,
      message: 'Đăng ký thành công!',
      token: this.jwtService.sign(payload),
      user: payload,
    };
  }

  async verify(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      return {
        success: true,
        user: decoded,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}