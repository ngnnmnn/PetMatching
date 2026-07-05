import { IsString } from 'class-validator';

export class PassPetDto {
  @IsString()
  femalePetId!: string;

  @IsString()
  malePetId!: string;
}
