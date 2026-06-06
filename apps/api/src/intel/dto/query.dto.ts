import { IsString, MaxLength, MinLength } from 'class-validator';

export class QueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question!: string;
}
