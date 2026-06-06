import { IsIn, IsUUID } from 'class-validator';
import { MOODS, type Mood } from '@pulse/shared-types';

export class ReassignDto {
  @IsUUID()
  assigneeId!: string;

  @IsIn([...MOODS])
  mood: Mood = 'neutral';
}
