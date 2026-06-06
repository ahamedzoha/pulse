import { IsIn } from 'class-validator';
import {
  MOODS,
  TASK_STATUSES,
  type Mood,
  type TaskStatus,
} from '@pulse/shared-types';

export class UpdateStatusDto {
  @IsIn([...TASK_STATUSES])
  status!: TaskStatus;

  @IsIn([...MOODS])
  mood: Mood = 'neutral';
}
