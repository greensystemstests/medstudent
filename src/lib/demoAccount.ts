import {
  AccountApi,
  AccountApiError,
  ActivityEvent,
  AccountUser,
  CATEGORY_LABELS,
  DocumentCategory,
  PaidApplication,
  StoredDocument,
} from './account';

/**
 * In-memory stand-in for the account API, used in demo mode (?demo=1) so the profile can be
 * explored without a real account. Nothing leaves the browser; any 6-digit code signs in.
 */
export function createDemoAccountApi(): AccountApi {
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;

  let signedIn = true;
  const user: AccountUser = { email: 'lina.haddad@example.com', fullName: 'Lina Haddad', createdAt: iso(3 * DAY) };
  const application: PaidApplication = {
    paymentIntentId: 'pi_demo',
    receiptRef: 'DEMO4K2Q9X',
    amount: 18000,
    currency: 'eur',
    paidAt: iso(3 * DAY + HOUR),
    applicantName: 'Lina Haddad',
    degree: 'Medicine',
    university: 'Medical University of Sofia',
    intake: 'Autumn intake (October)',
    examSession: 'Decide with advisor',
    callDate: new Date(now + 2 * DAY).toISOString().slice(0, 10),
    callWindow: 'Afternoon (14:00–16:00 Sofia time)',
  };
  const files = new Map<string, Blob>();
  let documents: StoredDocument[] = [
    doc('passport', 'passport_photo_page.jpg', 'image/jpeg', 812_000, iso(2 * DAY)),
    doc('diploma', 'tawjihi_certificate_apostille.pdf', 'application/pdf', 1_430_000, iso(2 * DAY - HOUR)),
    doc('transcript', 'science_marksheet.pdf', 'application/pdf', 356_000, iso(DAY)),
  ];
  let activity: ActivityEvent[] = [
    event('document_uploaded', 'Science transcript: science_marksheet.pdf', iso(DAY)),
    event('signed_in', '', iso(DAY + 60_000)),
    event('document_uploaded', 'High school diploma: tawjihi_certificate_apostille.pdf', iso(2 * DAY - HOUR)),
    event('document_uploaded', 'Passport: passport_photo_page.jpg', iso(2 * DAY)),
    event('account_created', '', iso(3 * DAY)),
  ];

  function doc(category: DocumentCategory, filename: string, mimeType: string, sizeBytes: number, uploadedAt: string): StoredDocument {
    return { id: crypto.randomUUID(), category, categoryLabel: CATEGORY_LABELS[category], filename, mimeType, sizeBytes, status: 'received', uploadedAt };
  }
  function event(type: string, detail: string, at: string): ActivityEvent {
    return { id: crypto.randomUUID(), type, detail, at };
  }
  const log = (type: string, detail = '') => {
    activity = [event(type, detail, new Date().toISOString()), ...activity];
  };
  const pause = (ms = 350) => new Promise((r) => setTimeout(r, ms));
  const requireSignIn = () => {
    if (!signedIn) throw new AccountApiError('Please sign in again.', 401);
  };

  return {
    isDemo: true,
    isSignedIn: () => signedIn,
    async requestCode() {
      await pause();
      return { sent: true };
    },
    async verifyCode(email, code) {
      await pause();
      if (!/^\d{6}$/.test(code)) throw new AccountApiError('Enter the 6-digit code.', 401);
      signedIn = true;
      user.email = email || user.email;
      log('signed_in');
      return user;
    },
    async signOut() {
      log('signed_out');
      signedIn = false;
    },
    async getProfile() {
      requireSignIn();
      await pause(250);
      return { user, applications: [application], applicationsAvailable: true };
    },
    async getDocuments() {
      requireSignIn();
      await pause(200);
      return {
        documents,
        limits: { maxFileBytes: 10 * 1024 * 1024, maxDocuments: 30, maxTotalBytes: 100 * 1024 * 1024 },
        usage: { count: documents.length, bytes: documents.reduce((n, d) => n + d.sizeBytes, 0) },
      };
    },
    async getActivity() {
      requireSignIn();
      return { activity };
    },
    async deleteDocument(id) {
      const d = documents.find((x) => x.id === id);
      documents = documents.filter((x) => x.id !== id);
      files.delete(id);
      if (d) log('document_deleted', `${d.categoryLabel}: ${d.filename}`);
      return { ok: true };
    },
    async uploadDocument(file, category, onProgress) {
      requireSignIn();
      if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) throw new AccountApiError('Only PDF, JPG and PNG files are accepted.', 415);
      if (file.size > 10 * 1024 * 1024) throw new AccountApiError('Files can be up to 10 MB.', 413);
      for (let p = 0.2; p <= 1; p += 0.2) {
        onProgress(p);
        await pause(120);
      }
      const d = doc(category, file.name, file.type || 'application/octet-stream', file.size, new Date().toISOString());
      files.set(d.id, file);
      documents = [d, ...documents];
      log('document_uploaded', `${d.categoryLabel}: ${d.filename}`);
      return d;
    },
    async fetchDocumentBlobUrl(id, download) {
      const d = documents.find((x) => x.id === id);
      if (!d) throw new AccountApiError('Document not found.', 404);
      log(download ? 'document_downloaded' : 'document_opened', `${d.categoryLabel}: ${d.filename}`);
      const blob =
        files.get(id) ??
        new Blob(
          [`<html><body style="font-family:sans-serif;padding:40px;color:#334155">
            <h2 style="color:#006644">${d.filename}</h2>
            <p>Sample document in demo mode. Real files open here exactly as uploaded.</p></body></html>`],
          { type: 'text/html' },
        );
      return { url: URL.createObjectURL(blob), type: blob.type };
    },
  };
}
