import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name: string;

  /**
   * User the key acts as. Defaults to the requesting admin when omitted, so the
   * MCP server operates with that admin's per-user data scope.
   */
  @IsOptional()
  @IsString()
  userId?: string;
}
