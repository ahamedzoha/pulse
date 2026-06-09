import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MOODS, type Mood } from '@pulse/shared-types';

export class CreateCommentDto {
  @IsString()
  @MaxLength(2000)
  commentText!: string;

  // Omit to auto-derive energy from sentiment; present = manual override.
  @IsOptional()
  @IsIn([...MOODS])
  mood?: Mood;
}
