import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsISO8601, IsOptional, IsString } from 'class-validator';

export class UpdateBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  start?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}
