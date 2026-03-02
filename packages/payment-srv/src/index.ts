import { SHARED_PACKAGE_READY } from '@smartpay/shared';

function bootstrap(): void {
  if (!SHARED_PACKAGE_READY) {
    throw new Error('payment-srv failed to bootstrap because shared package is not ready.');
  }

  console.log('@smartpay/payment-srv bootstrap ready');
}

// FIXME: replace this bootstrap placeholder with the real service startup in a follow-up PR.
bootstrap();
