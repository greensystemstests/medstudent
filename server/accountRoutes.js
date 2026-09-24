import crypto from 'node:crypto';
import express from 'express';
import {
  createLoginCode,
  deleteDocument,
  deleteSession,
  documentUsage,
  getDocumentWithContent,
  insertDocument,
  listActivity,
  listDocuments,
  logActivity,
  setFullNameIfMissing,
  userForToken,
  verifyLoginCode,
} from './db.js';
import { decryptFile, encryptFile, KEY_ID, sniffFileType } from './fileCrypto.js';
import { sendLoginCodeEmail } from './mail.js';
import { ONBOARDING_FEE, PAYMENT_SOURCE } from './pricing.js';
import { rateLimit } from './rateLimit.js';

export const DOCUMENT_CATEGORIES = {
  passport: 'Passport',
  diploma: 'High school diploma',
  transcript: 'Science transcript',
  medical: 'Medical certificate',
  police: 'Police clearance',
  other: 'Other document',
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENTS = 30;
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase().slice(0, 200) : '');

function cleanFilename(name, ext) {
  const base = String(name || 'document')
    .replace(/[\u0000-\u001f\\/:*?"<>|]/g, '_')
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .trim()
    .slice(0, 100);
  return `${base || 'document'}.${ext}`;
}

const publicUser = (u) => ({ email: u.email, fullName: u.full_name || null, createdAt: u.created_at });

const publicDocument = (d) => ({
  id: d.id,
  category: d.category,
  categoryLabel: DOCUMENT_CATEGORIES[d.category] || d.category,
  filename: d.filename,
  mimeType: d.mime_type,
  sizeBytes: d.size_bytes,
  status: d.status,
  uploadedAt: d.created_at,
});

/** Paid applications for this email, read straight from Stripe so they can't drift out of sync. */
async function applicationsForEmail(stripe, email) {
  const escaped = email.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const result = await stripe.paymentIntents.search({
    query: `metadata['source']:'${PAYMENT_SOURCE}' AND metadata['applicant_email']:'${escaped}' AND status:'succeeded'`,
    limit: 20,
  });
  return result.data
    .filter((pi) => pi.metadata?.applicant_email === email && pi.amount === ONBOARDING_FEE.amount && pi.currency === ONBOARDING_FEE.currency)
    .map((pi) => ({
      paymentIntentId: pi.id,
      receiptRef: pi.id.slice(-10).toUpperCase(),
      amount: pi.amount,
      currency: pi.currency,
      paidAt: new Date(pi.created * 1000).toISOString(),
      applicantName: pi.metadata.applicant_name || null,
      degree: pi.metadata.degree || null,
      university: pi.metadata.university || null,
      intake: pi.metadata.intake || null,
      examSession: pi.metadata.exam_session || null,
      callDate: pi.metadata.call_date || null,
      callWindow: pi.metadata.call_window || null,
    }));
}

/**
 * Mounts the account API: passwordless sign-in by emailed 6-digit code, then per-user profile,
 * encrypted document storage and an activity log. Every document query is scoped to the
 * signed-in user's id, so one account can never list, open or delete another's files.
 *
 * @param {import('express').Express} app
 * @param {object} deps
 * @param {import('pg').Pool | null} deps.db
 * @param {Buffer | null} deps.fileKey
 * @param {(email: string, code: string) => Promise<void> | null} deps.deliverCode  null when no way to send codes
 * @param {import('stripe').Stripe | null} deps.stripe
 * @param {(line: string) => void} deps.log
 * @param {{ requestCode?: number, verify?: number, upload?: number }} [deps.rateLimits]  per-IP maximums (tests raise them)
 */
export function mountAccountRoutes(app, { db, fileKey, deliverCode, stripe, log, rateLimits = {} }) {
  const limits = { requestCode: 10, verify: 30, upload: 20, ...rateLimits };
  const accountsReady = Boolean(db && fileKey && deliverCode);
  const auth = express.Router();
  const me = express.Router();

  const ready = (_req, res, next) => {
    if (!accountsReady) return res.status(503).json({ error: 'Accounts are being set up. Please try again soon.' });
    res.set('Cache-Control', 'no-store');
    next();
  };

  // Express 4 doesn't forward rejected promises from async handlers; this sends them to onError.
  const safe = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  const requireUser = async (req, res, next) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    try {
      const user = token ? await userForToken(db, token) : null;
      if (!user) return res.status(401).json({ error: 'Please sign in again.' });
      req.user = user;
      req.sessionToken = token;
      next();
    } catch (err) {
      next(err);
    }
  };

  auth.post('/request-code', rateLimit({ windowMs: 10 * 60_000, max: limits.requestCode }), async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    try {
      const result = await createLoginCode(db, email);
      if ('retryAfterSeconds' in result) {
        return res.status(429).json({ error: `Please wait ${result.retryAfterSeconds}s before requesting another code.`, retryAfterSeconds: result.retryAfterSeconds });
      }
      await deliverCode(email, result.code);
      // Same answer whether or not the email already has an account.
      res.json({ sent: true });
    } catch (err) {
      log(`request-code error: ${err.message}`);
      res.status(502).json({ error: 'We could not send the code right now. Please try again.' });
    }
  });

  auth.post('/verify', rateLimit({ windowMs: 10 * 60_000, max: limits.verify }), async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\s/g, '') : '';
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    try {
      const result = await verifyLoginCode(db, email, code);
      if ('error' in result) return res.status(401).json({ error: result.error });
      await logActivity(db, result.user.id, result.isNewUser ? 'account_created' : 'signed_in');
      res.json({ token: result.token, user: publicUser(result.user) });
    } catch (err) {
      log(`verify error: ${err.message}`);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  });

  auth.post('/logout', requireUser, safe(async (req, res) => {
    await deleteSession(db, req.sessionToken);
    await logActivity(db, req.user.id, 'signed_out');
    res.json({ ok: true });
  }));

  me.use(requireUser);

  me.get('/', safe(async (req, res) => {
    let applications = [];
    let applicationsAvailable = Boolean(stripe);
    if (stripe) {
      try {
        applications = await applicationsForEmail(stripe, req.user.email);
        if (applications[0]?.applicantName && !req.user.full_name) {
          await setFullNameIfMissing(db, req.user.id, applications[0].applicantName);
          req.user.full_name = applications[0].applicantName;
        }
      } catch (err) {
        log(`applications lookup error: ${err.message}`);
        applicationsAvailable = false;
      }
    }
    res.json({ user: publicUser(req.user), applications, applicationsAvailable });
  }));

  me.get('/documents', safe(async (req, res) => {
    const [documents, usage] = await Promise.all([listDocuments(db, req.user.id), documentUsage(db, req.user.id)]);
    res.json({
      documents: documents.map(publicDocument),
      limits: { maxFileBytes: MAX_FILE_BYTES, maxDocuments: MAX_DOCUMENTS, maxTotalBytes: MAX_TOTAL_BYTES },
      usage,
      categories: DOCUMENT_CATEGORIES,
    });
  }));

  me.post(
    '/documents',
    rateLimit({ windowMs: 60_000, max: limits.upload }),
    express.raw({ type: () => true, limit: MAX_FILE_BYTES }),
    safe(async (req, res) => {
      const category = String(req.query.category || '');
      if (!DOCUMENT_CATEGORIES[category]) return res.status(400).json({ error: 'Please choose what kind of document this is.' });
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!body.length) return res.status(400).json({ error: 'The file is empty.' });
      const type = sniffFileType(body);
      if (!type) return res.status(415).json({ error: 'Only PDF, JPG and PNG files are accepted.' });

      const usage = await documentUsage(db, req.user.id);
      if (usage.count >= MAX_DOCUMENTS) return res.status(409).json({ error: `You can store up to ${MAX_DOCUMENTS} documents. Delete one to upload another.` });
      if (usage.bytes + body.length > MAX_TOTAL_BYTES) return res.status(409).json({ error: 'Your storage is full. Delete a document to upload another.' });

      const documentId = crypto.randomUUID();
      const sealed = encryptFile(fileKey, body, { userId: req.user.id, documentId });
      const filename = cleanFilename(req.query.filename, type.ext);
      const doc = await insertDocument(db, {
        id: documentId,
        userId: req.user.id,
        category,
        filename,
        mimeType: type.mime,
        sizeBytes: body.length,
        keyId: KEY_ID,
        ...sealed,
      });
      await logActivity(db, req.user.id, 'document_uploaded', `${DOCUMENT_CATEGORIES[category]}: ${filename}`);
      res.status(201).json({ document: publicDocument(doc) });
    }),
  );

  me.get('/documents/:id/file', safe(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Document not found.' });
    const doc = await getDocumentWithContent(db, req.user.id, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    let plaintext;
    try {
      plaintext = decryptFile(fileKey, { iv: doc.iv, authTag: doc.auth_tag, content: doc.content }, { userId: req.user.id, documentId: doc.id });
    } catch (err) {
      log(`decrypt failed for document ${doc.id}: ${err.message}`);
      return res.status(500).json({ error: 'This file could not be opened. Please contact us.' });
    }
    const download = req.query.download === '1';
    await logActivity(db, req.user.id, download ? 'document_downloaded' : 'document_opened', `${DOCUMENT_CATEGORIES[doc.category] || doc.category}: ${doc.filename}`);

    const disposition = download ? 'attachment' : 'inline';
    const asciiName = doc.filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    res.set({
      'Content-Type': doc.mime_type,
      'Content-Length': String(plaintext.length),
      'Content-Disposition': `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    });
    res.send(plaintext);
  }));

  me.delete('/documents/:id', safe(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Document not found.' });
    const doc = await deleteDocument(db, req.user.id, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    await logActivity(db, req.user.id, 'document_deleted', `${DOCUMENT_CATEGORIES[doc.category] || doc.category}: ${doc.filename}`);
    res.json({ ok: true });
  }));

  me.get('/activity', safe(async (req, res) => {
    const events = await listActivity(db, req.user.id);
    res.json({ activity: events.map((e) => ({ id: e.id, type: e.type, detail: e.detail, at: e.created_at })) });
  }));

  // Upload over the size limit, malformed JSON, or an unexpected DB error: answer in JSON, never an HTML stack.
  const onError = (err, _req, res, _next) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: `Files can be up to ${MAX_FILE_BYTES / 1024 / 1024} MB.` });
    }
    log(`account API error: ${err?.message}`);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  };
  auth.use(onError);
  me.use(onError);

  app.use('/api/auth', ready, auth);
  app.use('/api/me', ready, me);
  return { accountsReady };
}
