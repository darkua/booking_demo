import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class SendTemplateDto {
  @ApiProperty({
    description: 'Override template variables; defaults from booking if bookingId set',
  })
  @IsOptional()
  bookingId?: string;

  @ApiProperty({ required: false, description: 'Template var 1: customer name' })
  @IsOptional()
  @IsString()
  var1?: string;

  @ApiProperty({ required: false, description: 'Template var 2: salon name' })
  @IsOptional()
  @IsString()
  var2?: string;

  @ApiProperty({ required: false, description: 'Template var 3: services list' })
  @IsOptional()
  @IsString()
  var3?: string;

  @ApiProperty({ required: false, description: 'Template var 4: day string' })
  @IsOptional()
  @IsString()
  var4?: string;

  @ApiProperty({ required: false, description: 'Template var 5: hour string' })
  @IsOptional()
  @IsString()
  var5?: string;
}
