import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
} from '../../../common/constants/password-policy.constants';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4, { message: 'Tên đăng nhập phải có ít nhất 4 ký tự.' })
  @MaxLength(30, { message: 'Tên đăng nhập không được quá 30 ký tự.' })
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'Tên đăng nhập chỉ được chứa chữ cái, số, dấu chấm và gạch dưới.',
  })
  username!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_MIN_LENGTH_MESSAGE })
  password!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
