import { IsString, MinLength } from 'class-validator';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
} from '../../../common/constants/password-policy.constants';

export class ResetPasswordDto {
  @IsString()
  @MinLength(32, { message: 'Token đặt lại mật khẩu không hợp lệ.' })
  token!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_MIN_LENGTH_MESSAGE })
  newPassword!: string;

  @IsString()
  confirmPassword!: string;
}
