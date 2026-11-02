// Real provider adapters belong here once their APIs and credentials are available.
// Real adapters remain separate from the server-gated stakeholder simulator. There is no unsigned success webhook.
const providers = new Map();

export function paymentProvider(name) {
  const provider = providers.get(name);
  if (!provider) {
    const error = new Error('Online payments are not available yet. Please contact Hoysii support.');
    error.status = 503;
    error.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
    throw error;
  }
  // An adapter must implement createPayment, verifyPayment, and requestRefund.
  return provider;
}
