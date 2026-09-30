import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterStorageObjectDto {
  @IsString()
  @IsNotEmpty()
  storageKey!: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

export class LinkExperienceMediaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  featuredMediaId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryMediaIds?: string[];
}
