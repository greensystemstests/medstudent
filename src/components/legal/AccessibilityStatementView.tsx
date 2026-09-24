import React from 'react';
import { LEGAL_ENTITY, LEGAL_LAST_UPDATED } from '../../data/legal';
import { AppView } from '../../types';
import { Callout, Email, LegalLayout, List, Section, Table } from './LegalLayout';

const SECTIONS = [
  { id: 'commitment', title: 'Our commitment' },
  { id: 'status', title: 'Conformance status' },
  { id: 'settings', title: 'Accessibility settings on this site' },
  { id: 'measures', title: 'What we have done' },
  { id: 'limitations', title: 'Known limitations' },
  { id: 'compatibility', title: 'Compatibility' },
  { id: 'feedback', title: 'Feedback and help' },
  { id: 'enforcement', title: 'Enforcement' },
  { id: 'assessment', title: 'How we assessed this site' },
];

export const AccessibilityStatementView: React.FC<{ onNavigate: (view: AppView) => void; onOpenSettings: () => void }> = ({
  onNavigate,
  onOpenSettings,
}) => (
  <LegalLayout
    view="accessibility"
    title="Accessibility Statement"
    intro="We want everyone to be able to learn about studying medicine in Bulgaria, apply, pay and manage their documents on studybg.ac, including people who use a keyboard, a screen reader, magnification or other assistive technology."
    sections={SECTIONS}
    onNavigate={onNavigate}
  >
    <Section id="commitment" n={1} title="Our commitment">
      <p>
        We aim to meet the <strong>Web Content Accessibility Guidelines (WCAG) 2.2 at level AA</strong>, the standard referenced by
        the European standard EN 301 549 and the European Accessibility Act. Accessibility is part of how we design and test every new
        page and feature.
      </p>
    </Section>

    <Section id="status" n={2} title="Conformance status">
      <p>
        studybg.ac is <strong>partially conformant</strong> with WCAG 2.2 level AA. The main journeys meet the standard in our testing:
        browsing the site, the application, payment, your account and the legal pages. The exceptions are listed under{' '}
        <a
          href="#limitations"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('limitations')?.scrollIntoView();
          }}
          className="text-[#006644] font-semibold underline"
        >
          Known limitations
        </a>
        .
      </p>
    </Section>

    <Section id="settings" n={3} title="Accessibility settings on this site">
      <p>
        Select the round <strong>accessibility button</strong> in the bottom-left corner of any page to adjust the site for yourself.
        Your choices are saved on your device and apply on every page:
      </p>
      <List
        items={[
          <><strong>Text size</strong>: four sizes, up to 150%.</>,
          <><strong>High contrast</strong>: darker text and borders, underlined links.</>,
          <><strong>Highlight links</strong>: underline every link.</>,
          <><strong>Readable font</strong>: a plain, wide font.</>,
          <><strong>Text spacing</strong>: more space between lines, letters and words.</>,
          <><strong>Stop animations</strong>: no movement or smooth scrolling. We also follow your device's “reduce motion” setting.</>,
          <><strong>Large cursor</strong>: a bigger, high-contrast mouse pointer.</>,
        ]}
      />
      <p>
        <button type="button" onClick={onOpenSettings} className="text-[#006644] font-semibold underline">
          Open accessibility settings now
        </button>
      </p>
      <p>
        These settings add to, and don't replace, your own tools: browser zoom up to 400%, your device's text size and contrast
        settings, and screen readers all work with the site.
      </p>
    </Section>

    <Section id="measures" n={4} title="What we have done">
      <Table
        head={['Area', 'What it means for you']}
        rows={[
          ['Keyboard', 'Everything can be used with a keyboard alone, with a clearly visible focus outline. A “Skip to main content” link is the first thing on every page.'],
          ['Screen readers', 'Pages use proper headings and landmarks. Every button and form field has a name. Selected options, switches, tabs and errors are announced. Each page has its own title, and focus moves to the new page when you navigate.'],
          ['Colour and contrast', 'Text meets at least a 4.5:1 contrast ratio, and information is never shown by colour alone.'],
          ['Resizing and reflow', 'Text can be enlarged to 200% and the layout works down to 320 pixels wide without scrolling sideways.'],
          ['Forms', 'Every field has a visible label. Errors are listed in words with how to fix them, and your answers are saved, so you never have to type them twice.'],
          ['Signing in', 'No password to remember, and you can paste the emailed code. If a code expires, you can request a new one.'],
          ['Pop-up windows', 'Pop-ups keep keyboard focus inside them, close with the Escape key and return you to where you were.'],
          ['Movement', 'Nothing flashes, and animations stop if you ask for reduced motion.'],
          ['Touch', 'Buttons and links are large enough to tap easily.'],
        ]}
      />
    </Section>

    <Section id="limitations" n={5} title="Known limitations">
      <List
        items={[
          <><strong>Card payment form</strong>: the card fields on the payment step are provided by our payment processor, Stripe, inside a secure frame. We can't change them, but Stripe designs them to be accessible, including with screen readers.</>,
          <><strong>Video consultation calls</strong>: calls take place on Zoom, which has its own accessibility features, such as captions and keyboard shortcuts. Tell us if you need an alternative, such as a phone call or email.</>,
          <><strong>Documents you upload</strong>: whether a PDF or image works with assistive technology depends on how it was created. Scanned documents are usually images of text.</>,
          <><strong>Sample-data demo pages</strong>: the demonstration Student Portal and Staff Operations pages (shown only in demo mode) haven't yet been reviewed to the same standard.</>,
        ]}
      />
    </Section>

    <Section id="compatibility" n={6} title="Compatibility">
      <p>
        The site is built with standard HTML and WAI-ARIA, so it works with the current versions of Chrome, Edge, Firefox and Safari on
        desktop and mobile, and with assistive technologies that support them.
      </p>
    </Section>

    <Section id="feedback" n={7} title="Feedback and help">
      <Callout>
        If anything on the site is hard to use, or you need information in a different format, please tell us. We'll help you complete
        your application another way, for example by email or phone.
      </Callout>
      <p>
        Email <Email address={LEGAL_ENTITY.contactEmail} /> and tell us which page you were on and what happened. We aim to reply within
        5 working days.
      </p>
    </Section>

    <Section id="enforcement" n={8} title="Enforcement">
      <p>
        If you aren't satisfied with our response, you can contact the Bulgarian Commission for Consumer Protection (
        <span lang="bg">Комисия за защита на потребителите</span>, www.kzp.bg), or the authority responsible for accessibility in the
        EU country where you live.
      </p>
    </Section>

    <Section id="assessment" n={9} title="How we assessed this site">
      <p>
        This statement was prepared on {LEGAL_LAST_UPDATED} following a self-assessment: automated WCAG 2.2 A and AA testing of every
        page and step of the application with axe-core, keyboard-only testing of all journeys, and testing at 320-pixel width and 200%
        text size. It hasn't been independently audited. We review it whenever we make significant changes to the site.
      </p>
    </Section>
  </LegalLayout>
);
