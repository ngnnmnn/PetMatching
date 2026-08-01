import { IsString, MinLength } from 'class-validator';
import { PASSWORD_MIN_LENGTH } from '../../../common/constants/password-policy.constants';

export class LoginDto {
  @IsString()
  identifier!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  password!: string;
}
