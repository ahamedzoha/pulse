import { IsIn, IsString, MaxLength } from 'class-validator';
import { MOODS, type Mood } from '@pulse/shared-types';

export class CreateCommentDto {
  @IsString()
  @MaxLength(2000)
  commentText!: string;

  @IsIn([...MOODS])
  mood: Mood = 'neutral';
}
