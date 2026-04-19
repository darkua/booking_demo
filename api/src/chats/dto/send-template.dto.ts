import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class SendTemplateDto {
  @ApiProperty({
    description: 'Override template variables; defaults from booking if bookingId set',
  })
  @IsOptional()
  bookingId?: string;

  @ApiProperty({ required: false, description: 'Twilio content variable 1 (date)' })
  @IsOptional()
  @IsString()
  var1?: string;

  @ApiProperty({ required: false, description: 'Twilio content variable 2 (time)' })
  @IsOptional()
  @IsString()
  var2?: string;
}
