import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MOODS, type Mood } from '@pulse/shared-types';

export class CreateTaskDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  // Omit to auto-derive energy from sentiment; present = manual override.
  @IsOptional()
  @IsIn([...MOODS])
  mood?: Mood;
}
