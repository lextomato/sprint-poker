import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 40)
  displayName!: string;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
