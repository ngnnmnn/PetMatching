import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMatchMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}
