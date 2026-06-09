import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { MOODS, type Mood } from '@pulse/shared-types';

export class ReassignDto {
  @IsUUID()
  assigneeId!: string;

  // Omit to auto-derive energy from sentiment; present = manual override.
  @IsOptional()
  @IsIn([...MOODS])
  mood?: Mood;
}
