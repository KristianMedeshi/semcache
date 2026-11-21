import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthEventsListener } from './auth-events.listener';
import { CredentialsService } from './credentials.service';
import { DrizzleSessionStore } from './drizzle-session.store';
import { UserPolicy } from './policies/user.policy';
import { SessionAuth } from './session-auth.provider';

@Module({
  imports: [DatabaseModule, UsersModule],
  controllers: [AuthController],
  providers: [DrizzleSessionStore, SessionAuth, CredentialsService, UserPolicy, AuthEventsListener],
  exports: [CredentialsService, UserPolicy],
})
export class AuthModule {}
