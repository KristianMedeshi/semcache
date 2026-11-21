import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KnowledgeBasePolicy } from './policies/knowledge-base.policy';

@Module({
  imports: [AuthenticationModule.forRoot({}), AuthorizationModule.forRoot()],
  controllers: [AppController],
  providers: [AppService, KnowledgeBasePolicy],
  exports: [KnowledgeBasePolicy],
})
export class AppModule {}
