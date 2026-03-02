import { SHARED_PACKAGE_READY } from '@smartpay/shared';

function bootstrap(): void {
  if (!SHARED_PACKAGE_READY) {
    throw new Error('routing-srv failed to bootstrap because shared package is not ready.');
  }

  console.log('@smartpay/routing-srv bootstrap ready');
}

// FIXME: replace this bootstrap placeholder with the real service startup in a follow-up PR.
bootstrap();
