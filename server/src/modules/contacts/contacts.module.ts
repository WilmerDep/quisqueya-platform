import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContactsController } from './contacts.controller.js';

@Module({ imports: [AuthModule], controllers: [ContactsController] })
export class ContactsModule {}
