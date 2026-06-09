import { IsIn, IsOptional } from 'class-validator';
import {
  MOODS,
  TASK_STATUSES,
  type Mood,
  type TaskStatus,
} from '@pulse/shared-types';

export class UpdateStatusDto {
  @IsIn([...TASK_STATUSES])
  status!: TaskStatus;

  // Omit to auto-derive energy from sentiment; present = manual override.
  @IsOptional()
  @IsIn([...MOODS])
  mood?: Mood;
}
