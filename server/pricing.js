// The onboarding fee is fixed on the server. The browser never decides how much is charged.
export const ONBOARDING_FEE = { amount: 18000, currency: 'eur' };

// Tag on every PaymentIntent we create, so lookups can refuse unrelated intents.
export const PAYMENT_SOURCE = 'studybg-wizard';
