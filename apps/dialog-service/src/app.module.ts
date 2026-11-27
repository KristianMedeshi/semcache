import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { SharedConfigModule, createRpcGlobalProviders } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/dialog-auth-types';
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
  providers: [AppService, ...createRpcGlobalProviders(ServiceName.DIALOG_SERVICE)],
})
export class AppModule {}
