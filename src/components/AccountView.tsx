import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  CreditCard,
  Download,
  Eye,
  FileText,
  FolderOpen,
  GraduationCap,
  History,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import {
  AccountApi,
  AccountApiError,
  AccountUser,
  ActivityEvent,
  CATEGORY_LABELS,
  DocumentCategory,
  DocumentsResponse,
  formatBytes,
  PaidApplication,
  REQUIRED_DOCUMENTS,
  StoredDocument,
} from '../lib/account';
import { formatDay } from '../lib/application';
import { AppView } from '../types';
import { formatMoney } from './PaymentStep';

interface AccountViewProps {
  api: AccountApi;
  defaultEmail?: string;
  onNavigate: (view: AppView) => void;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong. Please try again.');

export const AccountView: React.FC<AccountViewProps> = ({ api, defaultEmail, onNavigate }) => {
  const [signedIn, setSignedIn] = useState(api.isSignedIn());

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 sm:px-6 lg:px-8" id="account-view">
      <div className="max-w-6xl mx-auto">
        {api.isDemo && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
            <strong>Demo account:</strong> sample data only. Nothing you upload here leaves your browser, and any 6-digit code signs in.
          </div>
        )}
        {signedIn ? (
          <Profile api={api} onNavigate={onNavigate} onSignedOut={() => setSignedIn(false)} />
        ) : (
          <SignIn api={api} defaultEmail={defaultEmail} onSignedIn={() => setSignedIn(true)} />
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Sign in                                                                     */
/* -------------------------------------------------------------------------- */

const SignIn: React.FC<{ api: AccountApi; defaultEmail?: string; onSignedIn: () => void }> = ({ api, defaultEmail, onSignedIn }) => {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.requestCode(email.trim());
      setStep('code');
      setCode('');
      setCooldown(30);
      setTimeout(() => codeInput.current?.focus(), 50);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.verifyCode(email.trim(), code);
      onSignedIn();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto" id="sign-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-[#0f1e36] to-[#006644] text-white p-6">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-emerald-300" />
          </div>
          <h1 className="text-xl font-bold font-heading">My StudyBg account</h1>
          <p className="text-sm text-slate-200 mt-1">See your application and keep your documents in one secure place.</p>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={sendCode} className="space-y-4">
              <div>
                <label htmlFor="signin-email" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Your email
                </label>
                <input
                  id="signin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:bg-white focus:border-[#006644] focus:ring-1 focus:ring-[#006644] outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">Use the email you applied with, so we can show your application.</p>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#006644] hover:bg-[#005538] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Email me a sign-in code
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs text-emerald-900">
                We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
              </div>
              <div>
                <label htmlFor="signin-code" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Sign-in code
                </label>
                <input
                  id="signin-code"
                  ref={codeInput}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-3 text-2xl font-bold tracking-[0.5em] text-center text-slate-900 focus:bg-white focus:border-[#006644] focus:ring-1 focus:ring-[#006644] outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#006644] hover:bg-[#005538] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Sign in
              </button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => { setStep('email'); setError(null); }} className="text-slate-600 hover:text-[#006644] font-semibold">
                  Use a different email
                </button>
                <button
                  type="button"
                  disabled={cooldown > 0 || busy}
                  onClick={() => sendCode()}
                  className="text-[#006644] font-semibold disabled:text-slate-400"
                >
                  {cooldown > 0 ? `Send a new code (${cooldown}s)` : 'Send a new code'}
                </button>
              </div>
            </form>
          )}

          <ul className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
            <li className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#006644]" /> No password to remember
            </li>
            <li className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#006644]" /> Your documents are stored encrypted
            </li>
            <li className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#006644]" /> Every action on your account is logged for you to see
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Profile                                                                     */
/* -------------------------------------------------------------------------- */

type Tab = 'overview' | 'documents' | 'activity';

interface ProfileData {
  user: AccountUser;
  applications: PaidApplication[];
  applicationsAvailable: boolean;
  docs: DocumentsResponse;
  activity: ActivityEvent[];
}

const Profile: React.FC<{ api: AccountApi; onNavigate: (view: AppView) => void; onSignedOut: () => void }> = ({
  api,
  onNavigate,
  onSignedOut,
}) => {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory | null>(null);

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof AccountApiError && err.status === 401) {
        onSignedOut();
        return true;
      }
      return false;
    },
    [onSignedOut],
  );

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [profile, docs, { activity }] = await Promise.all([api.getProfile(), api.getDocuments(), api.getActivity()]);
      setData({ ...profile, docs, activity });
    } catch (err) {
      if (!handleAuthError(err)) setLoadError(errorMessage(err));
    }
  }, [api, handleAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshDocsAndActivity = async () => {
    try {
      const [docs, { activity }] = await Promise.all([api.getDocuments(), api.getActivity()]);
      setData((d) => (d ? { ...d, docs, activity } : d));
    } catch (err) {
      handleAuthError(err);
    }
  };

  const signOut = async () => {
    await api.signOut().catch(() => {});
    onSignedOut();
  };

  if (loadError) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-sm text-slate-700">{loadError}</p>
        <button onClick={load} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#006644] hover:bg-[#005538]">
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#006644]" /> Loading your account…
      </div>
    );
  }

  const { user, applications } = data;
  const displayName = user.fullName || user.email.split('@')[0];
  const uploadedCategories = new Set(data.docs.documents.map((d) => d.category));
  const requiredDone = REQUIRED_DOCUMENTS.filter((r) => uploadedCategories.has(r.category)).length;

  const openUpload = (category: DocumentCategory) => {
    setUploadCategory(category);
    setTab('documents');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6" id="profile">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f1e36] to-[#00281b] text-white p-6 sm:p-8 border border-emerald-500/30 shadow-lg">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-emerald-400/10" aria-hidden />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-400/20 border border-emerald-300/30 flex items-center justify-center text-2xl font-extrabold font-heading text-emerald-300">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">My account</div>
              <h1 className="text-xl sm:text-2xl font-bold font-heading">Welcome, {displayName.split(' ')[0]}</h1>
              <div className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5" /> {user.email}
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            id="sign-out-btn"
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/15 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1 shadow-2xs">
        {(
          [
            ['overview', 'Overview', LayoutDashboard],
            ['documents', `Documents (${data.docs.documents.length})`, FolderOpen],
            ['activity', 'Activity', History],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === id ? 'bg-[#006644] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-4 h-4 hidden sm:block" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-6">
            {applications.length > 0 ? (
              applications.map((a) => <ApplicationCard key={a.paymentIntentId} app={a} />)
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3">
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-slate-500" />
                </div>
                <h2 className="font-bold font-heading text-slate-900">
                  {data.applicationsAvailable ? 'No paid application yet' : "We couldn't load your application right now"}
                </h2>
                <p className="text-xs text-slate-600">
                  {data.applicationsAvailable
                    ? `We didn't find a paid application for ${user.email}. If you applied with a different email, sign in with that one. Just paid? It can take a minute to appear.`
                    : 'Please refresh in a moment. Your documents are still available below.'}
                </p>
                <button
                  onClick={() => onNavigate('wizard')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#006644] hover:bg-[#005538]"
                >
                  Continue my application <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#006644] shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 space-y-1">
                <div className="font-bold text-slate-900">How your files are protected</div>
                <p>
                  Documents are encrypted before they're stored, and they only open while you're signed in. Every upload, view and
                  deletion appears in your <button onClick={() => setTab('activity')} className="text-[#006644] font-semibold underline">Activity</button>.
                </p>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4" id="document-checklist">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-bold font-heading text-slate-900">Your document checklist</h2>
                <span className="text-xs font-bold text-[#006644]">
                  {requiredDone} of {REQUIRED_DOCUMENTS.length}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-[#006644] rounded-full transition-all"
                  style={{ width: `${(requiredDone / REQUIRED_DOCUMENTS.length) * 100}%` }}
                />
              </div>
            </div>
            <ul className="space-y-2">
              {REQUIRED_DOCUMENTS.map((r) => {
                const done = uploadedCategories.has(r.category);
                return (
                  <li key={r.category} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                    {done ? <CheckCircle2 className="w-5 h-5 text-[#006644] shrink-0" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="font-bold text-slate-900">{r.label}</div>
                      <div className="text-slate-500 truncate">{done ? 'Uploaded' : r.hint}</div>
                    </div>
                    {!done && (
                      <button
                        onClick={() => openUpload(r.category)}
                        className="text-xs font-bold text-[#006644] hover:underline inline-flex items-center gap-1 shrink-0"
                      >
                        <Upload className="w-3.5 h-3.5" /> Upload
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <DocumentsTab
          api={api}
          docs={data.docs}
          initialCategory={uploadCategory}
          onChanged={refreshDocsAndActivity}
          onAuthError={handleAuthError}
        />
      )}

      {tab === 'activity' && <ActivityTab activity={data.activity} applications={applications} />}
    </div>
  );
};

const ApplicationCard: React.FC<{ app: PaidApplication }> = ({ app }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden" data-testid="application-card">
    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Your application</div>
        <div className="font-bold font-heading text-slate-900">
          {app.degree} · {app.university}
        </div>
      </div>
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-[#006644] shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5" /> Paid
      </span>
    </div>
    <dl className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
      <Detail icon={CreditCard} label="Onboarding package" value={`${formatMoney(app.amount, app.currency)} · ${new Date(app.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`} />
      <Detail icon={FileText} label="Payment reference" value={app.receiptRef} mono />
      <Detail
        icon={CalendarClock}
        label="Consultation call requested"
        value={app.callDate ? `${formatDay(app.callDate, { weekday: 'short', day: 'numeric', month: 'short' })}, ${app.callWindow ?? ''}` : '—'}
      />
      <Detail icon={GraduationCap} label="Intake · entrance exam" value={`${app.intake ?? '—'} · ${app.examSession === 'Decide with advisor' ? 'chosen on your call' : app.examSession ?? '—'}`} />
    </dl>
  </div>
);

const Detail: React.FC<{ icon: React.ElementType; label: string; value: string; mono?: boolean }> = ({ icon: Icon, label, value, mono }) => (
  <div className="flex items-start gap-2.5">
    <Icon className="w-4 h-4 text-[#006644] shrink-0 mt-0.5" />
    <div className="min-w-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-semibold text-slate-900 break-words ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

const DocumentsTab: React.FC<{
  api: AccountApi;
  docs: DocumentsResponse;
  initialCategory: DocumentCategory | null;
  onChanged: () => Promise<void>;
  onAuthError: (err: unknown) => boolean;
}> = ({ api, docs, initialCategory, onChanged, onAuthError }) => {
  const [category, setCategory] = useState<DocumentCategory | null>(initialCategory);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [preview, setPreview] = useState<{ doc: StoredDocument; url: string; type: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    if (!category) return setMessage({ kind: 'error', text: 'First choose what kind of document this is.' });
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return setMessage({ kind: 'error', text: 'Only PDF, JPG and PNG files are accepted.' });
    if (file.size > docs.limits.maxFileBytes) {
      return setMessage({ kind: 'error', text: `This file is ${formatBytes(file.size)}. Files can be up to ${formatBytes(docs.limits.maxFileBytes)}.` });
    }
    setUploading({ name: file.name, progress: 0 });
    try {
      const saved = await api.uploadDocument(file, category, (p) => setUploading({ name: file.name, progress: p }));
      setMessage({ kind: 'ok', text: `${saved.filename} uploaded as “${saved.categoryLabel}”.` });
      setCategory(null);
      await onChanged();
    } catch (err) {
      if (!onAuthError(err)) setMessage({ kind: 'error', text: errorMessage(err) });
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const open = async (doc: StoredDocument) => {
    setBusyId(doc.id);
    try {
      const { url, type } = await api.fetchDocumentBlobUrl(doc.id);
      setPreview({ doc, url, type });
      onChanged();
    } catch (err) {
      if (!onAuthError(err)) setMessage({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const download = async (doc: StoredDocument) => {
    setBusyId(doc.id);
    try {
      const { url } = await api.fetchDocumentBlobUrl(doc.id, true);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      onChanged();
    } catch (err) {
      if (!onAuthError(err)) setMessage({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (doc: StoredDocument) => {
    if (!window.confirm(`Delete “${doc.filename}”? This can't be undone.`)) return;
    setBusyId(doc.id);
    try {
      await api.deleteDocument(doc.id);
      setMessage({ kind: 'ok', text: `${doc.filename} deleted.` });
      await onChanged();
    } catch (err) {
      if (!onAuthError(err)) setMessage({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="documents-tab">
      {/* Upload */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5 lg:sticky lg:top-28">
        <div>
          <h2 className="font-bold font-heading text-slate-900">Upload a document</h2>
          <p className="text-xs text-slate-500 mt-0.5">Two quick steps. PDF, JPG or PNG, up to {formatBytes(docs.limits.maxFileBytes)}.</p>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700 mb-2">
            <span className="inline-flex w-5 h-5 rounded-full bg-[#006644] text-white text-[10px] font-bold items-center justify-center mr-1.5">1</span>
            What is it?
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CATEGORY_LABELS) as DocumentCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`px-3 py-2 rounded-xl border text-left text-xs font-semibold transition-all ${
                  category === c
                    ? 'border-[#006644] bg-emerald-50/70 text-[#006644] ring-1 ring-[#006644]'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                }`}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700 mb-2">
            <span className="inline-flex w-5 h-5 rounded-full bg-[#006644] text-white text-[10px] font-bold items-center justify-center mr-1.5">2</span>
            Choose the file
          </div>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              upload(e.dataTransfer.files[0]);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
              !category ? 'opacity-60 cursor-not-allowed border-slate-200' : dragging ? 'border-[#006644] bg-emerald-50' : 'border-slate-300 hover:border-[#006644] hover:bg-emerald-50/40'
            }`}
          >
            <Upload className="w-7 h-7 text-[#006644]" />
            <span className="text-sm font-semibold text-slate-800">{category ? 'Drop your file here, or tap to choose' : 'Choose the document type first'}</span>
            <span className="text-[11px] text-slate-500">A clear scan or photo of the whole page works best</span>
            <input
              ref={fileInput}
              id="document-file-input"
              type="file"
              accept={ACCEPT}
              disabled={!category || Boolean(uploading)}
              className="sr-only"
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
        </div>

        {uploading && (
          <div className="space-y-1.5" aria-live="polite">
            <div className="flex justify-between text-xs text-slate-600">
              <span className="truncate">Uploading {uploading.name}…</span>
              <span>{Math.round(uploading.progress * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-[#006644] transition-all" style={{ width: `${uploading.progress * 100}%` }} />
            </div>
          </div>
        )}

        {message && (
          <div
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`rounded-xl border px-3 py-2.5 text-xs flex items-start gap-2 ${
              message.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {message.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[#006644]" />
          {docs.usage.count} of {docs.limits.maxDocuments} files · {formatBytes(docs.usage.bytes)} of {formatBytes(docs.limits.maxTotalBytes)} used
        </div>
      </div>

      {/* List */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold font-heading text-slate-900">My documents</h2>
        </div>
        {docs.documents.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <FolderOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="font-semibold text-slate-800">No documents yet</div>
            <p className="text-xs text-slate-500">Start with your passport: choose “Passport”, then pick the file.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100" id="document-list">
            {docs.documents.map((doc) => {
              const Icon = doc.mimeType.startsWith('image/') ? ImageIcon : FileText;
              const busy = busyId === doc.id;
              return (
                <li key={doc.id} className="px-4 sm:px-6 py-4 flex items-center gap-3" data-testid="document-row">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#006644]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate" title={doc.filename}>
                      {doc.filename}
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
                      <span className="font-semibold text-slate-700">{doc.categoryLabel}</span>
                      <span>{formatBytes(doc.sizeBytes)}</span>
                      <span>{new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span className="inline-flex items-center gap-1 text-[#006644] font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Received
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400 m-2" />
                    ) : (
                      <>
                        <IconButton label={`View ${doc.filename}`} onClick={() => open(doc)} icon={Eye} />
                        <IconButton label={`Download ${doc.filename}`} onClick={() => download(doc)} icon={Download} />
                        <IconButton label={`Delete ${doc.filename}`} onClick={() => remove(doc)} icon={Trash2} danger />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {preview && (
        <PreviewModal
          doc={preview.doc}
          url={preview.url}
          type={preview.type}
          onDownload={() => download(preview.doc)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
};

const IconButton: React.FC<{ label: string; icon: React.ElementType; onClick: () => void; danger?: boolean }> = ({ label, icon: Icon, onClick, danger }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`p-2 rounded-lg transition-colors ${danger ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-500 hover:text-[#006644] hover:bg-emerald-50'}`}
  >
    <Icon className="w-4 h-4" />
  </button>
);

const PreviewModal: React.FC<{ doc: StoredDocument; url: string; type: string; onDownload: () => void; onClose: () => void }> = ({
  doc,
  url,
  type,
  onDownload,
  onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={doc.filename}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
          <FileText className="w-4 h-4 text-[#006644] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{doc.filename}</div>
            <div className="text-[11px] text-slate-500">{doc.categoryLabel}</div>
          </div>
          <button onClick={onDownload} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#006644] bg-emerald-50 hover:bg-emerald-100">
            <Download className="w-3.5 h-3.5" /> Download
          </button>
          <button onClick={onClose} aria-label="Close preview" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center">
          {type.startsWith('image/') ? (
            <img src={url} alt={doc.filename} className="max-w-full max-h-full object-contain" />
          ) : (
            <iframe src={url} title={doc.filename} className="w-full h-full bg-white" />
          )}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Activity                                                                    */
/* -------------------------------------------------------------------------- */

const ACTIVITY_COPY: Record<string, { icon: React.ElementType; text: (detail: string) => string }> = {
  account_created: { icon: UserPlus, text: () => 'You created your account' },
  signed_in: { icon: LogIn, text: () => 'You signed in' },
  signed_out: { icon: LogOut, text: () => 'You signed out' },
  document_uploaded: { icon: Upload, text: (d) => `You uploaded ${d}` },
  document_opened: { icon: Eye, text: (d) => `You opened ${d}` },
  document_downloaded: { icon: Download, text: (d) => `You downloaded ${d}` },
  document_deleted: { icon: Trash2, text: (d) => `You deleted ${d}` },
  payment: { icon: CreditCard, text: (d) => d },
};

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

const ActivityTab: React.FC<{ activity: ActivityEvent[]; applications: PaidApplication[] }> = ({ activity, applications }) => {
  const events = [
    ...activity,
    ...applications.map((a) => ({
      id: a.paymentIntentId,
      type: 'payment',
      detail: `You paid the ${formatMoney(a.amount, a.currency)} onboarding fee (ref. ${a.receiptRef})`,
      at: a.paidAt,
    })),
  ].sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs" id="activity-tab">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="font-bold font-heading text-slate-900">Everything done with your account</h2>
        <p className="text-xs text-slate-500 mt-0.5">Newest first. If you see something you don't recognise, sign out and contact us.</p>
      </div>
      {events.length === 0 ? (
        <p className="p-6 text-xs text-slate-500">Nothing yet.</p>
      ) : (
        <ol className="p-6 space-y-0" id="activity-list">
          {events.map((e, i) => {
            const copy = ACTIVITY_COPY[e.type] ?? { icon: History, text: (d: string) => d || e.type };
            const Icon = copy.icon;
            return (
              <li key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#006644]" />
                  </div>
                  {i < events.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
                </div>
                <div className="pb-5 min-w-0">
                  <div className="text-sm text-slate-900 break-words">{copy.text(e.detail)}</div>
                  <div className="text-[11px] text-slate-500">
                    {new Date(e.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {timeAgo(e.at)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
