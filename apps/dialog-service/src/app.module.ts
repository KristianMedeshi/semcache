import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { SharedConfigModule } from '@semcache/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/dialog-auth-types';
import { HttpToRpcExceptionFilter } from './common/http-to-rpc-exception.filter';
import { dialogEnvSchema } from './config/dialog.env';
import { DatabaseModule } from './db/database.module';
import { DialogsModule } from './dialogs/dialogs.module';

@Module({
  imports: [
    SharedConfigModule.forRoot(dialogEnvSchema),
    DatabaseModule,
    AuthenticationModule.forRoot({}),
    AuthorizationModule.forRoot(),
    DialogsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpToRpcExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      }),
    },
  ],
})
export class AppModule {}
