import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: '+4915901600682', description: 'E.164 phone' })
  @IsString()
  @MinLength(8)
  phoneE164!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  clientName!: string;

  @ApiProperty({ example: '2026-04-20T14:00:00.000Z' })
  @IsISO8601()
  start!: string;

  @ApiProperty({ type: [String], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  services!: string[];

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  durationMinutes?: number;

  @ApiPropertyOptional({
    description: 'If false, do not send WhatsApp confirmation template',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sendConfirmationTemplate?: boolean;
}
