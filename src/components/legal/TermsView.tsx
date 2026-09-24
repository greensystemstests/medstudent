import React from 'react';
import { ONBOARDING_FEE_EUR, ONBOARDING_INCLUSIONS } from '../../data/constants';
import { LEGAL_ENTITY } from '../../data/legal';
import { AppView } from '../../types';
import { Callout, ControllerBlock, Email, LegalLayout, List, PageLink, Section, Sub } from './LegalLayout';

const SECTIONS = [
  { id: 'about', title: 'About these terms' },
  { id: 'service', title: 'Our service' },
  { id: 'no-guarantee', title: 'What we can\'t guarantee' },
  { id: 'eligibility', title: 'Who can use the service' },
  { id: 'ordering', title: 'How the contract is made' },
  { id: 'price', title: 'Price and payment' },
  { id: 'call', title: 'Your consultation call' },
  { id: 'withdrawal', title: 'Your right to withdraw (14 days)' },
  { id: 'our-cancellation', title: 'If we can\'t provide the service' },
  { id: 'account', title: 'Your account and documents' },
  { id: 'acceptable-use', title: 'Acceptable use' },
  { id: 'ip', title: 'Our content' },
  { id: 'liability', title: 'Our responsibility to you' },
  { id: 'complaints', title: 'Complaints and disputes' },
  { id: 'law', title: 'Governing law' },
  { id: 'changes', title: 'Changes to these terms' },
  { id: 'withdrawal-form', title: 'Model withdrawal form' },
];

export const TermsView: React.FC<{ onNavigate: (view: AppView) => void }> = ({ onNavigate }) => (
  <LegalLayout
    view="terms"
    title="Terms & Conditions"
    intro={`The agreement between you and StudyBg when you use studybg.ac and buy the €${ONBOARDING_FEE_EUR} onboarding & advisory package. Please read these terms before you pay. If you are a consumer, nothing in them takes away your rights under mandatory consumer protection law.`}
    sections={SECTIONS}
    onNavigate={onNavigate}
  >
    <Section id="about" n={1} title="About these terms">
      <p>These terms are an agreement between you and:</p>
      <ControllerBlock />
      <p>
        General contact: <Email address={LEGAL_ENTITY.contactEmail} />. The contract is made in English. How we handle your personal
        information is explained in our <PageLink to="privacy" onNavigate={onNavigate}>Privacy Policy</PageLink>, which forms part of
        these terms.
      </p>
    </Section>

    <Section id="service" n={2} title="Our service">
      <p>
        StudyBg is an independent advisory and application-support service for students who want to study English-taught Medicine,
        Dentistry or Pharmacy at Bulgarian universities. The onboarding & advisory package (the “<strong>Package</strong>”) includes:
      </p>
      <List
        items={ONBOARDING_INCLUSIONS.map((item) => (
          <>
            <strong>{item.title}:</strong> {item.detail}
          </>
        ))}
      />
      <Sub title="Not included in the Package price">
        <p>These costs are charged separately by the organisations concerned, or passed on to you at cost with no markup when we arrange them for you. We will always tell you the amount before you commit to it:</p>
        <List
          items={[
            'university tuition, application, registration and entrance exam fees;',
            'sworn translation, apostille, legalisation and notary fees;',
            'courier and postage costs;',
            'visa, residence permit and other government fees;',
            'travel, accommodation, health insurance and living costs.',
          ]}
        />
      </Sub>
    </Section>

    <Section id="no-guarantee" n={3} title="What we can't guarantee">
      <Callout>
        StudyBg is not a university and not a government authority. <strong>Admission decisions are made only by the universities</strong>,
        and visa and residence decisions only by the competent authorities. We don't guarantee that you will be admitted to any university
        or granted a visa or residence permit.
      </Callout>
      <p>
        Eligibility results from our Quick Fit check and application form are indicative only. Our advice reflects the rules, deadlines
        and fees published by universities and authorities at the time. These can change without notice, and such changes are outside our
        control.
      </p>
    </Section>

    <Section id="eligibility" n={4} title="Who can use the service">
      <List
        items={[
          'If you are under 18, a parent or legal guardian must agree to the purchase and to these terms on your behalf.',
          'You must give us true, accurate and complete information, and keep it up to date.',
          'The documents you provide must be genuine. Submitting false or altered documents can lead to rejection by universities or authorities and may be a criminal offence. We will stop providing the service if we find a document is not genuine.',
        ]}
      />
    </Section>

    <Section id="ordering" n={5} title="How the contract is made">
      <p>
        You complete the application steps, review your details, accept these terms and pay. Before you pay, the payment page shows the
        Package, what it includes and the total price. You can go back and correct your details at any point before paying.
      </p>
      <p>
        The contract between us is made when your payment is confirmed. We then show a confirmation on screen and email you a receipt, and
        an invoice where applicable.
      </p>
    </Section>

    <Section id="price" n={6} title="Price and payment">
      <List
        items={[
          <>
            The Package costs <strong>€{ONBOARDING_FEE_EUR}.00</strong> (euro), payable once in advance. This is the total price for the
            Package, including any taxes that apply. It is not a subscription and nothing renews automatically.
          </>,
          'Payment is taken by card or another method shown at checkout, processed securely by Stripe. Your bank may charge its own currency conversion or international payment fees.',
          'We issue receipts and invoices electronically to the email address you gave us.',
        ]}
      />
    </Section>

    <Section id="call" n={7} title="Your consultation call">
      <p>
        You choose a preferred day and time during the application. We confirm the exact time by email and send you a video call link.
        The call lasts about 45 minutes. If you can't make it, tell us as early as possible and we will offer you another time.
      </p>
    </Section>

    <Section id="withdrawal" n={8} title="Your right to withdraw (14 days)">
      <p>
        If you are a consumer, you have the right to withdraw from this contract within <strong>14 days</strong> without giving any
        reason. The withdrawal period ends 14 days after the day the contract is made.
      </p>
      <p>
        To withdraw, tell us clearly before the period ends, for example by email to <Email address={LEGAL_ENTITY.contactEmail} />. You
        can use the <a href="#withdrawal-form" onClick={(e) => { e.preventDefault(); document.getElementById('withdrawal-form')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-[#006644] font-semibold underline">model withdrawal form</a>{' '}
        below, but you don't have to. It's enough to send your message before the 14 days are up.
      </p>
      <Sub title="Refunds">
        <p>
          If you withdraw, we refund all payments received from you without undue delay, and no later than 14 days after we receive your
          notice. We use the same payment method you used, unless you expressly agree otherwise. You won't be charged any fee for the
          refund.
        </p>
      </Sub>
      <Sub title="If the service has already started">
        <p>
          If you asked us to start providing the service within the 14-day period (for example by holding your consultation call or
          reviewing your documents), you must pay an amount in proportion to what we provided before you told us you were withdrawing,
          compared with the whole Package. We deduct this from your refund.
        </p>
        <p>
          If we have fully provided the service within the withdrawal period, after you expressly asked us to start and acknowledged that
          you would lose your right of withdrawal once the service was fully provided, you can no longer withdraw.
        </p>
      </Sub>
    </Section>

    <Section id="our-cancellation" n={9} title="If we can't provide the service">
      <p>
        If we can't provide the Package, for example because we can't offer you a consultation call within a reasonable time, we will
        tell you and refund what you paid for anything we haven't provided.
      </p>
    </Section>

    <Section id="account" n={10} title="Your account and documents">
      <List
        items={[
          'You sign in with a single-use code sent to your email. Keep access to your email account secure, and tell us straight away if you think someone else has used your account.',
          'You keep ownership of the documents you upload. You allow us to store, review, copy and send them only as needed to provide the service you asked for, as described in our Privacy Policy.',
          'You can delete documents yourself at any time. You can ask us to close your account whenever you like.',
          'We may suspend an account that is used in breach of these terms, and will tell you why.',
        ]}
      />
    </Section>

    <Section id="acceptable-use" n={11} title="Acceptable use">
      <p>You must not:</p>
      <List
        items={[
          'upload false, altered or someone else\'s documents, or anything unlawful;',
          'upload files containing viruses or other harmful code;',
          'try to access other people\'s accounts or data, or interfere with the security or operation of the site;',
          'copy, scrape or resell our content or services without our written permission.',
        ]}
      />
    </Section>

    <Section id="ip" n={12} title="Our content">
      <p>
        The site, its design and content, and the exam preparation materials are owned by StudyBg or its licensors. You may use them for
        your own personal preparation and application. You may not copy, share or sell them to others.
      </p>
    </Section>

    <Section id="liability" n={13} title="Our responsibility to you">
      <List
        items={[
          'We provide the service with reasonable care and skill.',
          'We are not responsible for decisions, delays or changes made by universities, authorities, couriers or other third parties, or for consequences of incorrect or incomplete information or documents you provided.',
          'Except where the law does not allow it, our total liability to you in connection with the Package is limited to the amount you paid for it.',
          'Nothing in these terms limits or excludes our liability for intentional wrongdoing or gross negligence, for death or personal injury caused by our negligence, or any other liability that cannot be limited or excluded by law. Your statutory rights as a consumer are not affected.',
        ]}
      />
    </Section>

    <Section id="complaints" n={14} title="Complaints and disputes">
      <p>
        If you're not happy with our service, please contact us first at <Email address={LEGAL_ENTITY.contactEmail} />. We aim to reply
        within 14 days and to resolve complaints quickly and fairly.
      </p>
      <p>
        If we can't resolve your complaint, consumers can contact the Bulgarian Commission for Consumer Protection (Комисия за защита на
        потребителите, www.kzp.bg), which can refer disputes to an out-of-court conciliation committee, or the consumer authority in their
        own country.
      </p>
    </Section>

    <Section id="law" n={15} title="Governing law">
      <p>
        These terms are governed by the laws of the Republic of Bulgaria. If you are a consumer, you also keep the protection of any
        mandatory provisions of the law of the country where you live. Disputes will be decided by the competent courts of Bulgaria, but
        as a consumer you may also bring proceedings in the courts of the country where you live, where the law allows this.
      </p>
    </Section>

    <Section id="changes" n={16} title="Changes to these terms">
      <p>
        We may update these terms from time to time. The version shown when you pay applies to your purchase. If we make changes that
        affect account holders, we'll tell them by email before the changes take effect.
      </p>
    </Section>

    <Section id="withdrawal-form" n={17} title="Model withdrawal form">
      <p className="text-slate-500">(Complete and return this form only if you wish to withdraw from the contract.)</p>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-2 text-sm font-mono leading-relaxed">
        <p>
          To: {LEGAL_ENTITY.name}, {LEGAL_ENTITY.address}, {LEGAL_ENTITY.contactEmail}
        </p>
        <p>I hereby give notice that I withdraw from my contract for the provision of the following service: StudyBg onboarding &amp; advisory package</p>
        <p>Ordered on: ______________________</p>
        <p>Name of consumer: ______________________</p>
        <p>Address of consumer: ______________________</p>
        <p>Payment reference (from your receipt): ______________________</p>
        <p>Signature of consumer (only if this form is sent on paper): ______________________</p>
        <p>Date: ______________________</p>
      </div>
    </Section>
  </LegalLayout>
);
