import React from 'react';
import { LEGAL_ENTITY } from '../../data/legal';
import { AppView } from '../../types';
import { Callout, ControllerBlock, Email, LegalLayout, List, PageLink, Section, Table } from './LegalLayout';

const SECTIONS = [
  { id: 'commitment', title: 'Our commitment' },
  { id: 'role', title: 'Our role under the GDPR' },
  { id: 'principles', title: 'How we apply the GDPR principles' },
  { id: 'rights', title: 'Your rights in detail' },
  { id: 'requests', title: 'How to make a request' },
  { id: 'consent', title: 'Consent and how to withdraw it' },
  { id: 'measures', title: 'Security and privacy by design' },
  { id: 'processors', title: 'Service providers and transfers' },
  { id: 'breaches', title: 'If something goes wrong' },
  { id: 'authority', title: 'Supervisory authority' },
];

export const GdprView: React.FC<{ onNavigate: (view: AppView) => void }> = ({ onNavigate }) => (
  <LegalLayout
    view="gdpr"
    title="GDPR Compliance"
    intro="How StudyBg meets its obligations under the EU General Data Protection Regulation (Regulation (EU) 2016/679), and how you can use your data protection rights. This page supplements our Privacy Policy."
    sections={SECTIONS}
    onNavigate={onNavigate}
  >
    <Section id="commitment" n={1} title="Our commitment">
      <Callout>
        We collect only what we need to help you apply, we explain why, we protect it, and{' '}
        <strong>we don't sell it or share it with anyone for their own purposes without your consent</strong>. Because we are established
        in the EU, these protections apply to every StudyBg user, whether you live in the EU or elsewhere.
      </Callout>
    </Section>

    <Section id="role" n={2} title="Our role under the GDPR">
      <p>
        StudyBg is the <strong>controller</strong> of the personal data described in our{' '}
        <PageLink to="privacy" onNavigate={onNavigate}>Privacy Policy</PageLink>: we decide why and how it is used. The companies that host
        our site, process payments and send our emails act as our <strong>processors</strong>. They may only use your data on our
        instructions.
      </p>
      <ControllerBlock />
    </Section>

    <Section id="principles" n={3} title="How we apply the GDPR principles">
      <Table
        head={['Principle', 'What it means at StudyBg']}
        rows={[
          ['Lawfulness, fairness and transparency', 'Every use of your data has a legal basis, listed in the Privacy Policy. We explain what we do in plain language.'],
          ['Purpose limitation', 'We use your data to provide the onboarding service, keep the site secure, meet legal duties and improve the site. We never use it for unrelated purposes such as selling it or advertising for others.'],
          ['Data minimisation', 'Application answers stay in your browser until the payment step, and even then we only receive what we need. Sign-in uses email codes, so we don\'t hold passwords.'],
          ['Accuracy', 'You can review your details before paying and see your documents at any time in your account. Ask us to correct anything that\'s wrong.'],
          ['Storage limitation', 'We keep data only as long as set out in the retention table in the Privacy Policy, then delete it. Documents you delete are removed immediately.'],
          ['Integrity and confidentiality', 'Encryption in transit and at rest, per-account access control, hashed sign-in codes and sessions, and an activity log you can check (see section 7).'],
          ['Accountability', 'We document our processing activities, have contracts with our processors, and review these practices when our services change.'],
        ]}
      />
    </Section>

    <Section id="rights" n={4} title="Your rights in detail">
      <Table
        head={['Your right', 'What it means', 'How to use it']}
        rows={[
          ['Access (Art. 15)', 'Get confirmation of whether we process your data, a copy of it, and information about how we use it.', 'Your account shows your application, documents and activity. For a full copy, email us.'],
          ['Rectification (Art. 16)', 'Have inaccurate data corrected and incomplete data completed.', 'Email us with the correction.'],
          ['Erasure (Art. 17)', 'Have your data deleted, for example when it\'s no longer needed or you withdraw consent. Some records, such as invoices, must be kept by law.', 'Delete documents yourself in your account, or email us to delete your account and data.'],
          ['Restriction (Art. 18)', 'Ask us to pause using your data, for example while we check its accuracy.', 'Email us.'],
          ['Data portability (Art. 20)', 'Receive the data you gave us in a structured, commonly used, machine-readable format, or have it sent to another organisation.', 'Download your documents from your account, or email us for a full export.'],
          ['Objection (Art. 21)', 'Object to uses based on our legitimate interests, such as usage statistics. You can always object to direct marketing.', 'Email us.'],
          ['Withdraw consent (Art. 7(3))', 'Where we rely on your consent, withdraw it at any time. This doesn\'t affect what we did before.', 'See section 6.'],
          ['Complain (Art. 77)', 'Lodge a complaint with a supervisory authority.', 'See section 10.'],
        ]}
      />
      <p>
        We don't make decisions about you based solely on automated processing that have legal or similarly significant effects (Art. 22).
      </p>
    </Section>

    <Section id="requests" n={5} title="How to make a request">
      <List
        items={[
          <>
            Email <Email address={LEGAL_ENTITY.privacyEmail} /> from the email address linked to your StudyBg account, and say which right
            you want to use.
          </>,
          'If we can\'t confirm your identity from your email, we may ask for a little more information. We only use it to verify the request.',
          'We respond within one month. For complex or multiple requests we can extend this by up to two more months, and we will tell you within the first month if we need to.',
          'Requests are free. We may only charge a reasonable fee, or refuse, if a request is clearly unfounded or excessive, and we\'ll explain why.',
          'If we can\'t fully meet a request, for example because the law requires us to keep invoices, we will explain the reason.',
        ]}
      />
    </Section>

    <Section id="consent" n={6} title="Consent and how to withdraw it">
      <p>We ask for your consent, and rely on it, only for:</p>
      <List
        items={[
          'processing sensitive documents you upload, such as a medical certificate or police clearance certificate;',
          'usage statistics that need cookies or similar technologies which aren\'t strictly necessary;',
          'marketing emails, if you ever opt in to them.',
        ]}
      />
      <p>
        You can withdraw consent at any time, as easily as you gave it: delete the document in your account; for statistics, use the
        same setting where you gave your consent; use the unsubscribe link in any marketing email; or simply email{' '}
        <Email address={LEGAL_ENTITY.privacyEmail} />. Withdrawing consent
        doesn't affect processing we carried out before, but we may no longer be able to provide the parts of the service that depend on
        it.
      </p>
    </Section>

    <Section id="measures" n={7} title="Security and privacy by design">
      <List
        items={[
          'Encrypted connections (HTTPS/TLS) for the whole site and our servers.',
          'Uploaded documents encrypted with AES-256-GCM before storage. Each file is cryptographically tied to its owner, so it can\'t be read from another account.',
          'Each account can reach only its own documents; every request is checked against the signed-in user.',
          'Passwordless sign-in: single-use 6-digit codes that expire after 10 minutes and allow a limited number of attempts. Codes and session keys are stored only in hashed form.',
          'Sessions expire after 30 days, and signing out ends the session on our servers.',
          'Uploaded files are checked by their content; only PDF, JPG and PNG files are accepted.',
          'An activity log in your account shows every sign-in and document action.',
          'Card details are handled by Stripe (PCI-DSS Level 1) and never reach our servers.',
          'Our database and servers are located in the EU (Frankfurt, Germany).',
        ]}
      />
    </Section>

    <Section id="processors" n={8} title="Service providers and transfers">
      <p>
        We only use service providers that provide sufficient guarantees for protecting personal data, under data processing terms that
        meet Article 28 of the GDPR. The current list of providers, what they do and where they are is in section 8 of our{' '}
        <PageLink to="privacy" onNavigate={onNavigate}>Privacy Policy</PageLink>.
      </p>
      <p>
        Where personal data is transferred outside the European Economic Area, we rely on European Commission adequacy decisions where
        available, or on Standard Contractual Clauses, together with an assessment of the risks of the transfer. Contact us for more
        information about these safeguards.
      </p>
    </Section>

    <Section id="breaches" n={9} title="If something goes wrong">
      <p>
        If we become aware of a personal data breach, we act immediately to contain it and assess the risk. Where it's likely to affect
        your rights and freedoms, we notify the Commission for Personal Data Protection within 72 hours. Where the risk to you is high, we
        also tell you directly, without undue delay, with what happened and what you can do. We keep a record of every breach, whether or
        not it has to be reported.
      </p>
    </Section>

    <Section id="authority" n={10} title="Supervisory authority">
      <p>Our lead supervisory authority is:</p>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm space-y-0.5">
        <div className="font-bold text-slate-900">Commission for Personal Data Protection (<span lang="bg">Комисия за защита на личните данни</span>)</div>
        <div>2 Prof. Tsvetan Lazarov Blvd., Sofia 1592, Bulgaria</div>
        <div>www.cpdp.bg</div>
      </div>
      <p>
        You can also complain to the data protection authority in the EU country where you live, work, or where you believe the
        infringement took place. We'd appreciate the chance to resolve your concern first, so please contact us at{' '}
        <Email address={LEGAL_ENTITY.privacyEmail} />.
      </p>
    </Section>
  </LegalLayout>
);
