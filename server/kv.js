import Redis from 'ioredis';

const SEQ_KEY = 'studybg:invoice:seq';
const NUMBER_PREFIX = 'studybg:invoice:pi:'; // PaymentIntent id -> invoice number (assigned once, forever)
const SENT_PREFIX = 'studybg:invoice:sent:'; // PaymentIntent id -> '1' only once the emails have actually gone out
const RECORD_PREFIX = 'studybg:invoice:no:'; // invoice number -> record JSON, for audit/bookkeeping lookups

// Atomic: check-existing-or-reserve-and-store happens as one Redis operation, so two webhook
// deliveries racing for the same PaymentIntent can never both increment the counter (which
// would burn a number and break the sequential, gap-free numbering Bulgarian invoices require).
//   KEYS[1] = number key for this PaymentIntent   ARGV[1] = seq key   ARGV[2] = startNumber - 1
const RESERVE_SCRIPT = `
local existing = redis.call('GET', KEYS[1])
if existing then return tonumber(existing) end
redis.call('SETNX', ARGV[1], ARGV[2])
local number = redis.call('INCR', ARGV[1])
redis.call('SET', KEYS[1], number)
return number
`;

/**
 * @param {string | undefined} url  REDIS_URL from Render Key Value. Returns null (not a client)
 *   when unset, so callers can degrade gracefully instead of crashing the webhook.
 */
export function connectKv(url) {
  if (!url) return null;
  return new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
}

/**
 * Assigns the (permanent, gap-free) sequential invoice number for this PaymentIntent.
 * Safe to call repeatedly — a webhook retry gets back the same number, never a new one.
 * This says nothing about whether the receipt email was actually sent; see markInvoiceSent.
 */
export async function reserveInvoiceNumber(kv, paymentIntentId, startNumber) {
  return kv.eval(RESERVE_SCRIPT, 1, NUMBER_PREFIX + paymentIntentId, SEQ_KEY, String(startNumber - 1));
}

/** True once markInvoiceSent has completed for this PaymentIntent — i.e. the emails truly went out. */
export async function isInvoiceSent(kv, paymentIntentId) {
  return Boolean(await kv.get(SENT_PREFIX + paymentIntentId));
}

/** Call only after the receipt/notification emails have been sent successfully. */
export async function markInvoiceSent(kv, paymentIntentId) {
  await kv.set(SENT_PREFIX + paymentIntentId, '1');
}

export async function saveInvoiceRecord(kv, invoiceNumber, record) {
  await kv.set(RECORD_PREFIX + invoiceNumber, JSON.stringify(record));
}

export async function getInvoiceRecord(kv, invoiceNumber) {
  const raw = await kv.get(RECORD_PREFIX + invoiceNumber);
  return raw ? JSON.parse(raw) : null;
}
