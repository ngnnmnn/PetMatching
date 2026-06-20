import { IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(3)
  password: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  constructor() {
    this.username = '';
    this.password = '';
  }
}