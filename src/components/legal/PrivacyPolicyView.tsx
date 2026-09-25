import React from 'react';
import { scrollBehavior } from '../../lib/a11y';
import { LEGAL_ENTITY } from '../../data/legal';
import { AppView } from '../../types';
import { Callout, ControllerBlock, Email, LegalLayout, List, PageLink, Section, Sub, Table } from './LegalLayout';

const SECTIONS = [
  { id: 'who-we-are', title: 'Who we are' },
  { id: 'scope', title: 'What this policy covers' },
  { id: 'data-we-collect', title: 'The information we collect' },
  { id: 'how-we-use', title: 'How we use it and why (legal bases)' },
  { id: 'sensitive-data', title: 'Sensitive documents' },
  { id: 'statistics', title: 'Usage statistics' },
  { id: 'cookies', title: 'Cookies and browser storage' },
  { id: 'sharing', title: 'Who we share information with' },
  { id: 'transfers', title: 'Transfers outside the EU' },
  { id: 'retention', title: 'How long we keep it' },
  { id: 'security', title: 'How we protect it' },
  { id: 'your-rights', title: 'Your rights' },
  { id: 'young-applicants', title: 'Young applicants' },
  { id: 'automated-decisions', title: 'Automated decisions' },
  { id: 'changes', title: 'Changes to this policy' },
  { id: 'contact', title: 'Contact and complaints' },
];

export const PrivacyPolicyView: React.FC<{ onNavigate: (view: AppView) => void }> = ({ onNavigate }) => (
  <LegalLayout
    view="privacy"
    title="Privacy Policy"
    intro="How StudyBg collects, uses and protects your personal information when you use studybg.ac, apply for our onboarding package, and use your student account. In short: we only use your information to provide our service and improve the site, we never sell it, and we don't share it with anyone for their own purposes without your consent."
    sections={SECTIONS}
    onNavigate={onNavigate}
  >
    <Section id="who-we-are" n={1} title="Who we are">
      <p>
        StudyBg (“<strong>we</strong>”, “<strong>us</strong>”) is the data controller responsible for your personal information. We are
        established in Bulgaria, so we follow the EU General Data Protection Regulation (“<strong>GDPR</strong>”) and the Bulgarian
        Personal Data Protection Act, and we apply the same protections to every user, wherever they live.
      </p>
      <ControllerBlock />
      <p>
        We have not appointed a Data Protection Officer, as the law does not require one for our activities. For any privacy question or
        request, write to <Email address={LEGAL_ENTITY.privacyEmail} />.
      </p>
    </Section>

    <Section id="scope" n={2} title="What this policy covers">
      <p>This policy applies when you:</p>
      <List
        items={[
          'browse studybg.ac or use the Quick Fit eligibility check;',
          'fill in the 8-step application and pay the onboarding fee;',
          'create and use your student account, including uploading documents;',
          'receive emails from us or join a consultation call with our advisors.',
        ]}
      />
      <p>
        It does not cover websites of other organisations we link to (for example universities or government authorities), which have
        their own privacy policies.
      </p>
    </Section>

    <Section id="data-we-collect" n={3} title="The information we collect">
      <Sub title="Information you give us">
        <List
          items={[
            <>
              <strong>Identity and contact details:</strong> full name, email address and (optionally) phone or WhatsApp number.
            </>,
            <>
              <strong>Application details:</strong> immigration category, country of passport, high school curriculum and graduation year,
              chosen degree, university and intake, Biology and Chemistry grades, English level, which required documents you have,
              preferred entrance exam session, document pickup address, and your preferred day and time for the consultation call.
            </>,
            <>
              <strong>Payment details:</strong> you pay through our payment provider, Stripe. Your card number and security code go
              directly to Stripe; we never see or store them. We receive the payment status, amount, date and a payment reference.
            </>,
            <>
              <strong>Account details:</strong> the email address you sign in with and your name.
            </>,
            <>
              <strong>Documents you upload:</strong> such as your passport, high school diploma, transcript, medical certificate and police
              clearance certificate, and any other document you choose to add.
            </>,
            <>
              <strong>Your messages:</strong> what you tell us by email or during the consultation call, and our notes from the call.
            </>,
          ]}
        />
      </Sub>
      <Sub title="Information collected automatically">
        <List
          items={[
            <>
              <strong>Technical data:</strong> when your browser connects to our servers, they log your IP address, browser and device type,
              the page or address requested and the time. This is needed to deliver the site and keep it secure.
            </>,
            <>
              <strong>Usage statistics:</strong> basic information about how the site is used. See{' '}
              <a href="#statistics" onClick={(e) => { e.preventDefault(); document.getElementById('statistics')?.scrollIntoView({ behavior: scrollBehavior() }); }} className="text-[#006644] font-semibold underline">section 6</a>.
            </>,
            <>
              <strong>Account activity:</strong> a log of sign-ins, sign-outs, and document uploads, views, downloads and deletions, with
              the date and time. You can see this log yourself in your account.
            </>,
          ]}
        />
      </Sub>
      <Sub title="Information from others">
        <p>
          Stripe tells us whether your payment succeeded. If you ask us to represent you, universities, the Bulgarian Ministry of
          Education and Science, sworn translators, couriers or migration authorities may send us information about your application,
          such as its status or requests for further documents.
        </p>
      </Sub>
      <Callout>
        Your draft is kept in your browser while you fill it in. When you sign in and choose Save online, or prepare checkout,
        we store your full application in your account, including grades, document-readiness answers, requested call window and
        any proposed collection address. At checkout we retain a snapshot of the application and the policy version you accepted.
        Stripe receives the payment amount and limited contact and application information; it does not receive uploaded documents.
      </Callout>
    </Section>
    <Section id="how-we-use" n={4} title="How we use it and why (legal bases)">
      <Table
        head={['Purpose', 'Information used', 'Legal basis (GDPR)']}
        rows={[
          ['Providing the onboarding package: checking your eligibility, preparing your application file, holding the consultation call', 'Identity, contact and application details, documents, messages', 'Performance of our contract with you, or steps you asked for before it (Art. 6(1)(b))'],
          ['Taking payment and preventing payment fraud', 'Contact details, payment details, technical data', 'Contract (Art. 6(1)(b)); our legitimate interest in preventing fraud (Art. 6(1)(f))'],
          ['Your student account: sign-in, storing your documents, showing your application', 'Account details, documents, account activity', 'Contract (Art. 6(1)(b))'],
          ['Sensitive documents (medical certificate, police clearance)', 'The documents themselves', 'Your explicit consent (Art. 9(2)(a) and Art. 10), see section 5'],
          ['Service emails: sign-in codes, receipts, invoices, call confirmations', 'Contact details, payment details', 'Contract (Art. 6(1)(b))'],
          ['Issuing invoices and keeping accounting records', 'Name, contact and payment details', 'Legal obligation under Bulgarian accounting and tax law (Art. 6(1)(c))'],
          ['Keeping the site and your account secure, preventing misuse', 'Technical data, account activity', 'Our legitimate interest in security (Art. 6(1)(f))'],
          ['Usage statistics to improve the site', 'Basic usage data', 'Your consent where cookies or similar technologies are needed (Art. 6(1)(a)); otherwise our legitimate interest in improving the site (Art. 6(1)(f))'],
          ['Handling complaints and legal claims', 'Any relevant information', 'Our legitimate interest in defending our rights (Art. 6(1)(f)); legal obligation where applicable'],
        ]}
      />
      <p>
        <strong>No marketing without consent.</strong> We don't send marketing emails unless you have opted in, and you can opt out at any
        time. Emails that are part of the service you bought (like sign-in codes and receipts) are not marketing.
      </p>
      <p>
        Where we rely on legitimate interests, we have weighed them against your rights, and you can object at any time (see{' '}
        <PageLink to="gdpr" onNavigate={onNavigate}>GDPR Compliance</PageLink>).
      </p>
    </Section>

    <Section id="sensitive-data" n={5} title="Sensitive documents">
      <p>
        Some documents needed for Bulgarian university and visa applications contain special categories of personal data: a{' '}
        <strong>medical certificate</strong> contains health information, and a <strong>police clearance certificate</strong> contains
        information about criminal records. We process these only because you choose to upload them for your own application, based on
        your explicit consent, and only to check them, prepare your file and submit it where you ask us to.
      </p>
      <p>
        You can withdraw your consent at any time by deleting the document in your account or by contacting us. This doesn't affect what
        we did before you withdrew it, but it may mean we can't complete the parts of your application that need that document.
      </p>
    </Section>

    <Section id="statistics" n={6} title="Usage statistics">
      <p>
        We use basic statistics about how people use the site, such as which pages are visited, how visitors arrive, the type of device
        and browser, and the approximate country (derived from the IP address). We use this only to understand what works, fix problems
        and make the site easier to use.
      </p>
      <List
        items={[
          'Statistics are used in aggregated form. We don\'t use them to identify you or build a profile of you.',
          'We don\'t sell statistics data or share it for advertising.',
          'Where collecting statistics needs cookies or similar technologies on your device that aren\'t strictly necessary, we only use them after you agree, and you can change your mind at any time.',
        ]}
      />
    </Section>

    <Section id="cookies" n={7} title="Cookies and browser storage">
      <p>We keep this to a minimum. The site itself uses no advertising or tracking cookies.</p>
      <Table
        head={['Name / type', 'What it does', 'How long', 'Consent needed?']}
        rows={[
          ['studybg.application.v1 (browser storage)', 'Saves your application progress on your device so you don\'t lose it', 'Until you clear it or start a new application', 'No, strictly necessary for the form you are filling in'],
          ['studybg.session (browser storage)', 'Keeps you signed in to your account', 'Until you sign out, or 30 days', 'No, strictly necessary for your account'],
          ['studybg.a11y (browser storage)', 'Remembers the accessibility settings you choose (text size, contrast, etc.)', 'Until you reset them or clear it', 'No, it only stores a preference you set'],
          ['studybg.demo (browser tab storage)', 'Remembers if you opened the demo preview', 'Until you close the tab', 'No, strictly necessary'],
          ['Stripe cookies (e.g. __stripe_mid, __stripe_sid)', 'Set by Stripe on the payment step to process payments and prevent fraud', 'Up to 1 year', 'No, strictly necessary for secure payment'],
          ['Statistics', 'See section 6', 'As described when you are asked', 'Yes, where they are not strictly necessary'],
        ]}
      />
      <p>
        The site loads fonts and some images from Google's servers. Your browser therefore sends your IP address to Google when a page
        loads. Google doesn't set cookies for this.
      </p>
      <p>
        You can clear browser storage and cookies at any time in your browser settings. If you do, you'll lose any unsaved application
        progress and be signed out.
      </p>
    </Section>

    <Section id="sharing" n={8} title="Who we share information with">
      <Callout>
        <strong>We never sell your personal information</strong>, and we don't share it with anyone for their own purposes without your
        consent.
      </Callout>
      <Sub title="Service providers who work for us">
        <p>
          These companies process information only on our instructions, under contracts that require them to keep it confidential and
          secure:
        </p>
        <Table
          head={['Provider', 'What they do for us', 'Where']}
          rows={[
            ['Render Services, Inc.', 'Runs our servers and database (including your account and encrypted documents)', 'Servers in Frankfurt, Germany (EU); company in the USA'],
            ['GitHub, Inc.', 'Hosts the public website', 'USA'],
            ['Stripe (Stripe Payments Europe Ltd. and Stripe, Inc.)', 'Processes payments and prevents fraud. Stripe also acts as an independent controller for its own legal and fraud-prevention obligations, under its own privacy policy', 'Ireland (EU) and USA'],
            ['Resend', 'Sends our emails (sign-in codes, receipts, invoices)', 'USA'],
            ['Zoom Video Communications, Inc.', 'Video platform for consultation calls', 'USA'],
            ['Google (Google Fonts and image hosting)', 'Delivers fonts and images to your browser', 'EU and USA'],
          ]}
        />
      </Sub>
      <Sub title="Organisations you ask us to deal with">
        <p>
          To provide the service, we share the relevant parts of your application and documents with universities, the Bulgarian Ministry
          of Education and Science, sworn translators, couriers and migration authorities. We only do this for the steps you ask us to
          handle for you, and we tell you before we submit anything.
        </p>
      </Sub>
      <Sub title="When the law requires it">
        <p>
          We may disclose information when legally required, for example to tax authorities for invoices, or in response to a valid
          request from a court or public authority. We may also use it to establish or defend legal claims.
        </p>
      </Sub>
      <Sub title="If our business changes">
        <p>
          If StudyBg is reorganised or transferred to another company, your information may pass to the new owner. They must keep
          protecting it as described in this policy, and we will tell you before this happens.
        </p>
      </Sub>
    </Section>

    <Section id="transfers" n={9} title="Transfers outside the EU">
      <p>
        We store your account and documents in the EU (Frankfurt, Germany). Some of our service providers are based in, or may access
        data from, the USA or other countries outside the European Economic Area. When information is transferred outside the EEA, we make
        sure it stays protected. We rely on adequacy decisions of the European Commission where available (such as for providers
        certified under the EU-US Data Privacy Framework), or on the European Commission's Standard Contractual Clauses. You can ask us for
        more information about these safeguards.
      </p>
    </Section>

    <Section id="retention" n={10} title="How long we keep it">
      <Table
        head={['Information', 'How long we keep it']}
        rows={[
          ['Application progress saved in your browser', 'On your device until you clear it or start a new application; we don\'t hold a copy until the payment step'],
          ['Application and account details, uploaded documents, account activity', 'While your account is active and for up to 24 months after your last activity or the end of your application, unless you delete them sooner or ask us to'],
          ['Documents you delete', 'Removed from our database immediately'],
          ['Sign-in codes', '10 minutes (single use)'],
          ['Sign-in sessions', 'Until you sign out, or 30 days at most'],
          ['Payment records and invoices', 'For the period required by Bulgarian accounting and tax law, currently up to 10 years'],
          ['Server logs (technical data)', 'For a short period set by our hosting providers, normally no more than a few weeks'],
          ['Emails and call notes', 'As long as needed for your application, then as for account details'],
        ]}
      />
    </Section>

    <Section id="security" n={11} title="How we protect it">
      <List
        items={[
          'All connections to studybg.ac and our servers are encrypted (HTTPS/TLS).',
          'Uploaded documents are encrypted (AES-256) before they are stored, and each file can only be opened by the account that uploaded it.',
          'We have no passwords to leak: you sign in with single-use codes sent to your email. We store sign-in codes and session keys only in a scrambled (hashed) form.',
          'Card details are handled by Stripe, which is certified to the PCI-DSS Level 1 standard. They never pass through our servers.',
          'Access to personal data within StudyBg is limited to people who need it to provide the service, and they are bound by confidentiality.',
          'Your account keeps a log of every sign-in and document action, so you can spot anything unexpected.',
        ]}
      />
      <p>
        No system is completely secure. If a personal data breach happens that is likely to put your rights at risk, we will notify the
        supervisory authority within 72 hours and tell you without undue delay where the law requires it.
      </p>
    </Section>

    <Section id="your-rights" n={12} title="Your rights">
      <p>You have the right to:</p>
      <List
        items={[
          'access the personal information we hold about you and get a copy;',
          'correct information that is wrong or incomplete;',
          'have your information deleted;',
          'restrict how we use it;',
          'receive your information in a portable format;',
          'object to uses based on our legitimate interests;',
          'withdraw your consent at any time, without affecting earlier processing;',
          'complain to a data protection supervisory authority.',
        ]}
      />
      <p>
        You can delete your own documents at any time in your account. For everything else, email <Email address={LEGAL_ENTITY.privacyEmail} />.
        We reply within one month. How each right works, and the limits the law places on them, is explained on our{' '}
        <PageLink to="gdpr" onNavigate={onNavigate}>GDPR Compliance</PageLink> page.
      </p>
    </Section>

    <Section id="young-applicants" n={13} title="Young applicants">
      <p>
        Our service is for students preparing for university, so some applicants may be under 18. The site is not intended for children
        under 14, and we don't knowingly collect their information. If you are under 18, please involve a parent or legal guardian: they
        need to agree to the purchase (see our <PageLink to="terms" onNavigate={onNavigate}>Terms &amp; Conditions</PageLink>). If you
        believe a child under 14 has given us information, contact us and we will delete it.
      </p>
    </Section>

    <Section id="automated-decisions" n={14} title="Automated decisions">
      <p>
        We don't make decisions about you based solely on automated processing that have legal or similarly significant effects. The Quick
        Fit check and the grade checks in the application are indicative tools only. Admission decisions are made by the universities, and
        your advisor reviews your file personally.
      </p>
    </Section>

    <Section id="changes" n={15} title="Changes to this policy">
      <p>
        We may update this policy when our services or the law change. The date at the top shows when it was last updated. If we make
        important changes, we will tell account holders by email before they take effect.
      </p>
    </Section>

    <Section id="contact" n={16} title="Contact and complaints">
      <p>
        For any question about your personal information, write to <Email address={LEGAL_ENTITY.privacyEmail} />, or post to{' '}
        {LEGAL_ENTITY.name}, {LEGAL_ENTITY.address}.
      </p>
      <p>
        If you're unhappy with how we handle your information, please tell us first so we can put it right. You can also complain to the
        Bulgarian Commission for Personal Data Protection (<span lang="bg">Комисия за защита на личните данни</span>), 2 Prof. Tsvetan Lazarov Blvd., Sofia
        1592, Bulgaria, www.cpdp.bg, or to the data protection authority in the EU country where you live or work.
      </p>
    </Section>
  </LegalLayout>
);
