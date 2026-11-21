import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AuthorizationEvents } from '@nestjs/authorization';
import type { UserResponseDto } from '@semcache/shared-dtos';
import type { Subscription } from 'rxjs';

@Injectable()
export class AuthEventsListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthEventsListener.name);
  private subscription?: Subscription;

  constructor(private readonly authorizationEvents: AuthorizationEvents) {}

  onModuleInit(): void {
    this.subscription = this.authorizationEvents.events$.subscribe((event) => {
      this.logger.warn(
        JSON.stringify({
          event: 'authz.denied',
          policy: event.policy,
          ability: event.ability,
          reason: event.reason,
          handler: event.handler,
          userId: (event.user as UserResponseDto | null)?.id ?? null,
        }),
      );
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
