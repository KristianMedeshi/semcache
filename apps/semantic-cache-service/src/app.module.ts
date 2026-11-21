import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SemanticCachePolicy } from './policies/semantic-cache.policy';

@Module({
  imports: [AuthenticationModule.forRoot({}), AuthorizationModule.forRoot()],
  controllers: [AppController],
  providers: [AppService, SemanticCachePolicy],
  exports: [SemanticCachePolicy],
})
export class AppModule {}
