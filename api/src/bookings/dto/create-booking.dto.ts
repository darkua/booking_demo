import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ description: 'Chat/client id (from chats API)' })
  @IsString()
  @MinLength(3)
  clientId!: string;

  @ApiProperty({ example: '2026-04-20T14:00:00.000Z' })
  @IsISO8601()
  start!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  services!: string[];

  @ApiProperty({ required: false, default: 60 })
  @IsOptional()
  durationMinutes?: number;
}
