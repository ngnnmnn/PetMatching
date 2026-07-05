import { IsBoolean } from 'class-validator';

export class UpdateAvailabilityDto {
  @IsBoolean()
  isAvailableForMatching!: boolean;
}
