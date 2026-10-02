import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmGoogleDriveRootDto {
  @IsString()
  @IsNotEmpty()
  folderId!: string;
}
