import React from "react";
import { ArrowRight, ExternalLink, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { SOURCE_REVIEW_DATE, UNIVERSITIES as SOURCES } from "../../../shared/admissions.js";
import {
  GATEWAY_EXCLUSIONS,
  GATEWAY_NAME,
  INDEPENDENCE_STATEMENT,
  ONBOARDING_FEE_EUR,
  ONBOARDING_INCLUSIONS,
} from "../../data/constants";
import { GUIDE_FAQS, UNIVERSITY_GUIDES } from "../../data/guides";
import { PAGE_META } from "../../data/seo";
import { formatLongDate } from "../../lib/admissions";
import { pathFor, universityView } from "../../lib/routes";
import { AppView, UniversityView } from "../../types";

const reviewDate = formatLongDate(new Date(`${SOURCE_REVIEW_DATE}T12:00:00`));

interface ContentProps {
  onOpenQuickFit: (universityId?: string) => void;
}

/** A plain link to another page. App intercepts the click, so it navigates without a reload. */
export const PageLink: React.FC<{ view: AppView; className?: string; children: React.ReactNode }> = ({
  view,
  className = "font-semibold text-[#006644] underline underline-offset-2",
  children,
}) => (
  <a href={pathFor(view)} className={className}>
    {children}
  </a>
);

const OfficialLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 font-semibold text-[#006644] underline underline-offset-2"
  >
    {children}
    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

const Breadcrumbs: React.FC<{ view: AppView }> = ({ view }) => {
  const trail: AppView[] = ["home", ...(PAGE_META[view].parents ?? [])];
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-slate-300">
      <ol className="flex flex-wrap items-center gap-1.5">
        {trail.map((v) => (
          <li key={v} className="flex items-center gap-1.5">
            <a href={pathFor(v)} className="underline underline-offset-2 hover:text-white">
              {PAGE_META[v].crumb}
            </a>
            <span aria-hidden="true">/</span>
          </li>
        ))}
        <li aria-current="page" className="text-white">
          {PAGE_META[view].crumb}
        </li>
      </ol>
    </nav>
  );
};

const PageHeader: React.FC<{ view: AppView; title: string; children: React.ReactNode }> = ({
  view,
  title,
  children,
}) => (
  <header className="bg-gradient-to-b from-[#0f1e36] to-[#00281b] text-white px-4 sm:px-6 lg:px-8 pt-8 pb-10">
    <div className="max-w-4xl mx-auto space-y-4">
      <Breadcrumbs view={view} />
      <h1 className="text-3xl sm:text-4xl font-extrabold font-heading tracking-tight leading-tight">
        {title}
      </h1>
      <div className="text-base text-slate-300 leading-relaxed max-w-3xl space-y-2">{children}</div>
      <p className="text-xs text-slate-400">
        Official sources last checked: <time dateTime={SOURCE_REVIEW_DATE}>{reviewDate}</time>
      </p>
    </div>
  </header>
);

const H2: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <h2 id={id} className="text-xl sm:text-2xl font-extrabold font-heading text-slate-900 scroll-mt-28">
    {children}
  </h2>
);

const Prose: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 text-slate-700 leading-relaxed">
    {children}
  </div>
);

const Bullets: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1.5 marker:text-[#006644]">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

const FaqList: React.FC<{ faqs: { q: string; a: string }[] }> = ({ faqs }) => (
  <div className="space-y-4">
    {faqs.map((f) => (
      <div key={f.q} className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-heading font-bold text-slate-900">{f.q}</h3>
        <p className="mt-1.5 text-sm">{f.a}</p>
      </div>
    ))}
  </div>
);

const FreeCheckCta: React.FC<ContentProps & { universityId?: string; label?: string }> = ({
  onOpenQuickFit,
  universityId,
  label = "Check your eligibility — Free",
}) => (
  <section aria-labelledby="cta-title" className="rounded-2xl bg-[#0f1e36] text-white p-6 sm:p-8">
    <h2 id="cta-title" className="text-xl sm:text-2xl font-extrabold font-heading">
      See where you stand before you decide
    </h2>
    <p className="text-slate-300 mt-2 text-sm sm:text-base">
      Five questions, no sign-up and no payment. You get a list of what looks ready, what needs
      checking, and a link to the official requirements.
    </p>
    <div className="mt-5 flex flex-col sm:flex-row gap-3">
      <button
        type="button"
        onClick={() => onOpenQuickFit(universityId)}
        className="min-h-11 px-6 py-3 bg-[#00a86b] hover:bg-[#00bf7a] text-[#04150f] font-bold rounded-xl text-sm inline-flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        {label}
      </button>
      <a
        href={`${pathFor("home")}#pricing-section`}
        className="min-h-11 px-5 py-3 border border-white/25 hover:bg-white/10 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
      >
        What the €{ONBOARDING_FEE_EUR} {GATEWAY_NAME} includes
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </a>
    </div>
  </section>
);

const UniversityCards: React.FC = () => (
  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {SOURCES.map((s) => {
      const g = UNIVERSITY_GUIDES[universityView(s.id)];
      return (
        <li key={s.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-2">
          <h3 className="font-heading font-bold text-lg text-slate-900">
            <PageLink view={universityView(s.id)} className="hover:text-[#006644] underline-offset-2 hover:underline">
              {g.name}
            </PageLink>
          </h3>
          <p className="text-sm text-slate-600 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-slate-500" aria-hidden="true" />
            {g.city} · {g.programs.join(", ")}
          </p>
          <p className="text-sm">{g.worthComparing}</p>
          <PageLink view={universityView(s.id)} className="mt-auto text-sm font-semibold text-[#006644] underline underline-offset-2">
            Requirements and deadlines for {g.shortName}
          </PageLink>
        </li>
      );
    })}
  </ul>
);

/* -------------------------------------------------------------------------------------------- */

export const GuideView: React.FC<ContentProps> = ({ onOpenQuickFit }) => (
  <article>
    <PageHeader view="guide" title="How to study medicine in Bulgaria in English">
      <p>
        A plain-language guide for international students applying to English-taught Medicine and
        Dentistry at Bulgaria’s four medical universities: who decides, what they ask for, which
        documents you’ll need and what it costs.
      </p>
    </PageHeader>
    <Prose>
      <nav aria-labelledby="toc-title" className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 id="toc-title" className="font-heading font-bold text-slate-900">On this page</h2>
        <ol className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm list-decimal pl-5">
          {[
            ["overview", "Studying medicine in Bulgaria: the basics"],
            ["universities", "The four medical universities"],
            ["requirements", "Entry requirements"],
            ["documents", "Documents, legalisation and translation"],
            ["timeline", "Intakes and deadlines"],
            ["visa", "Visas and residence"],
            ["costs", "Costs to plan for"],
            ["practising", "Practising after you graduate"],
            ["help", "How StudyBg can help"],
            ["faq", "Frequently asked questions"],
          ].map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-[#006644] underline underline-offset-2">{label}</a>
            </li>
          ))}
        </ol>
      </nav>

      <section aria-labelledby="overview" className="space-y-3">
        <H2 id="overview">Studying medicine in Bulgaria: the basics</H2>
        <p>
          Bulgaria is a European Union member state with four dedicated medical universities, in{" "}
          <strong>Sofia, Plovdiv, Varna and Pleven</strong>. Each one admits international students to
          Medicine, and most also to Dentistry and Pharmacy. Medicine is a six-year Master’s
          programme, with the final year spent in clinical training.
        </p>
        <p>
          There is no central application system. <strong>Each university sets its own entry
          requirements, documents and deadlines</strong>, and these can differ for EU and non-EU
          citizens and change from year to year. That’s why every fact on this page links back to
          the university’s own admissions page.
        </p>
        <p>
          A few multi-subject universities also have medical faculties. StudyBg’s comparison
          currently covers the four dedicated medical universities.
        </p>
      </section>

      <section aria-labelledby="universities" className="space-y-4">
        <H2 id="universities">The four medical universities</H2>
        <p>
          Location, programmes and what each university currently publishes. Open a university for
          its requirements, deadlines and official links, or{" "}
          <PageLink view="universities">compare all four</PageLink>.
        </p>
        <UniversityCards />
      </section>

      <section aria-labelledby="requirements" className="space-y-3">
        <H2 id="requirements">Entry requirements: what universities look at</H2>
        <Bullets
          items={[
            <><strong>A school-leaving qualification</strong> that gives access to university studies in the country that issued it.</>,
            <><strong>Biology and Chemistry.</strong> Some universities publish a minimum school grade. The Medical University of Plovdiv’s 2026/27 guide, for example, asks for an average of at least 62% in school Biology and Chemistry.</>,
            <><strong>Entrance exams.</strong> Some routes include entrance tests, usually in Biology and Chemistry. The Medical University of Pleven’s published requirements refer to them.</>,
            <><strong>English.</strong> Universities say what evidence of English they accept; this may be a certificate, your school results or their own test.</>,
            <><strong>Your citizenship.</strong> EU and non-EU applicants can have different deadlines, fees and steps.</>,
          ]}
        />
        <p>
          Not sure how your grades and qualification compare? The{" "}
          <button type="button" onClick={() => onOpenQuickFit()} className="font-semibold text-[#006644] underline underline-offset-2">
            free eligibility check
          </button>{" "}
          compares them with what your chosen university publishes.
        </p>
      </section>

      <section aria-labelledby="documents" className="space-y-3">
        <H2 id="documents">Documents, legalisation and translation</H2>
        <p>The official list for your route is the one that counts. Applications usually involve:</p>
        <Bullets
          items={[
            "Your school diploma and transcript of grades",
            "A copy of your passport",
            "A medical certificate, if the university asks for one",
            "Proof of English, if required for your route",
          ]}
        />
        <p>
          <strong>Legalisation.</strong> Documents issued abroad normally have to be legalised before
          a Bulgarian university accepts them: with an <strong>apostille</strong> if the issuing
          country is part of the Hague Apostille Convention, otherwise through consular legalisation.
        </p>
        <p>
          <strong>Translation.</strong> Documents not in Bulgarian usually need a sworn translation
          into Bulgarian. Some routes also require your school diploma to be formally recognised in
          Bulgaria; the university’s instructions say whether and when.
        </p>
        <p>
          Legalisation and translation take time and money, so they are worth planning before
          deadlines get close.
        </p>
      </section>

      <section aria-labelledby="timeline" className="space-y-3">
        <H2 id="timeline">Intakes and deadlines</H2>
        <p>
          The main intake starts in the autumn, with application deadlines in the summer and early
          autumn. The Medical University of Pleven has published a February 2027 intake window for
          non-EU applicants. Exam dates and deadlines differ by university and citizenship.
        </p>
        <p>
          See the published dates on the <PageLink view="calendar">admissions calendar</PageLink>.
        </p>
      </section>

      <section aria-labelledby="visa" className="space-y-3">
        <H2 id="visa">Visas and residence</H2>
        <p>
          Students from outside the EU usually need a long-stay (type D) visa to study in Bulgaria,
          followed by a residence permit after arrival. EU citizens don’t need a visa but register
          their stay. Requirements are set by the Bulgarian authorities and can change, so check
          them with the Bulgarian embassy or consulate for your country.
        </p>
      </section>

      <section aria-labelledby="costs" className="space-y-3">
        <H2 id="costs">Costs to plan for</H2>
        <p>
          Tuition is set by each university and can depend on your citizenship and programme; confirm
          the current figure on the official page. Budget also for:
        </p>
        <Bullets items={GATEWAY_EXCLUSIONS} />
      </section>

      <section aria-labelledby="practising" className="space-y-3">
        <H2 id="practising">Practising after you graduate</H2>
        <p>
          A Bulgarian medical degree doesn’t automatically let you practise everywhere. Recognition,
          licensing exams and language requirements are set by the regulator in the country where
          you plan to work. Check their current rules, including which universities they recognise,
          before you apply.
        </p>
      </section>

      <section aria-labelledby="help" className="space-y-3">
        <H2 id="help">How StudyBg can help</H2>
        <p>
          You can apply to every university directly. If you want an independent person to go
          through your file, the <strong>€{ONBOARDING_FEE_EUR} {GATEWAY_NAME}</strong> is a one-time
          fee that includes:
        </p>
        <Bullets
          items={ONBOARDING_INCLUSIONS.map((i) => (
            <><strong>{i.title}.</strong> {i.detail}</>
          ))}
        />
        <p className="flex gap-2 text-sm bg-slate-50 border border-slate-200 rounded-xl p-4">
          <ShieldCheck className="w-5 h-5 text-[#006644] shrink-0" aria-hidden="true" />
          <span>{INDEPENDENCE_STATEMENT}</span>
        </p>
      </section>

      <FreeCheckCta onOpenQuickFit={onOpenQuickFit} />

      <section aria-labelledby="faq" className="space-y-4">
        <H2 id="faq">Frequently asked questions</H2>
        <FaqList faqs={GUIDE_FAQS} />
      </section>
    </Prose>
  </article>
);

/* -------------------------------------------------------------------------------------------- */

export const UniversitiesView: React.FC<ContentProps> = ({ onOpenQuickFit }) => (
  <div>
    <PageHeader view="universities" title="Medical universities in Bulgaria that teach in English">
      <p>
        Bulgaria’s four medical universities, in Sofia, Plovdiv, Varna and Pleven, admit international
        students. Each sets its own requirements and deadlines. Here’s what each one publishes.
      </p>
    </PageHeader>
    <Prose>
      <section aria-labelledby="list-title" className="space-y-4">
        <H2 id="list-title">Compare the four universities</H2>
        <UniversityCards />
      </section>
      <section aria-labelledby="rules-title" className="space-y-4">
        <H2 id="rules-title">Published entry rules at a glance</H2>
        <dl className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200">
          {SOURCES.map((s) => (
            <div key={s.id} className="p-5 grid sm:grid-cols-[14rem_1fr] gap-2">
              <dt className="font-semibold text-slate-900">
                <PageLink view={universityView(s.id)}>{UNIVERSITY_GUIDES[universityView(s.id)].name}</PageLink>
              </dt>
              <dd className="text-sm space-y-1">
                <p>{s.rule}</p>
                <p className="text-slate-600">{UNIVERSITY_GUIDES[universityView(s.id)].deadline}</p>
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-sm">
          New to the process? Read <PageLink view="guide">how to study medicine in Bulgaria in English</PageLink>.
        </p>
      </section>
      <FreeCheckCta onOpenQuickFit={onOpenQuickFit} />
    </Prose>
  </div>
);

/* -------------------------------------------------------------------------------------------- */

export const UniversityPage: React.FC<ContentProps & { view: UniversityView }> = ({ view, onOpenQuickFit }) => {
  const g = UNIVERSITY_GUIDES[view];
  const others = SOURCES.filter((s) => s.id !== g.id);
  return (
    <article>
      <PageHeader view={view} title={`${g.name}: admission for international students`}>
        <p>
          {g.location} The {g.name} is one of Bulgaria’s four medical universities. Our comparison
          covers {g.programs.join(", ").replace(/, ([^,]*)$/, " and $1")}.
        </p>
      </PageHeader>
      <Prose>
        <section aria-labelledby="facts-title" className="space-y-3">
          <H2 id="facts-title">Key facts</H2>
          <dl className="bg-white rounded-2xl border border-slate-200 p-5 grid sm:grid-cols-[11rem_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="font-semibold text-slate-900">City</dt>
            <dd>{g.city}, Bulgaria</dd>
            <dt className="font-semibold text-slate-900">Programmes</dt>
            <dd>
              {g.programs.join(", ")}{" "}
              <span className="text-slate-500">(confirm language and places for your citizenship)</span>
            </dd>
            <dt className="font-semibold text-slate-900">Published rule</dt>
            <dd>{g.rule}</dd>
            <dt className="font-semibold text-slate-900">Dates</dt>
            <dd>{g.deadline}</dd>
            <dt className="font-semibold text-slate-900">Tuition</dt>
            <dd>Set by the university; confirm the current figure on the official page.</dd>
            <dt className="font-semibold text-slate-900">Official page</dt>
            <dd>
              <OfficialLink href={g.source}>Admissions for international students</OfficialLink>
            </dd>
          </dl>
        </section>

        <section aria-labelledby="fit-title" className="space-y-3">
          <H2 id="fit-title">Is {g.shortName} a good fit for you?</H2>
          <p>{g.worthComparing}</p>
          <p>
            Whether you meet the requirements depends on your school qualification, your Biology and
            Chemistry results, your citizenship and the documents your country issues. The free check
            compares your situation with what the {g.name} publishes.
          </p>
          <button
            type="button"
            onClick={() => onOpenQuickFit(g.id)}
            className="min-h-11 px-5 py-3 bg-[#006644] hover:bg-[#005538] text-white font-semibold rounded-xl text-sm inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            Check my fit for {g.shortName}
          </button>
        </section>

        <section aria-labelledby="steps-title" className="space-y-3">
          <H2 id="steps-title">How to apply</H2>
          <ol className="list-decimal pl-5 space-y-1.5 marker:text-[#006644] marker:font-bold">
            <li>Read the official requirements for your citizenship and qualification.</li>
            <li>Check the published deadline and any entrance-exam dates.</li>
            <li>Prepare your diploma and transcript, then legalisation and sworn translation as required.</li>
            <li>Submit your application to the university yourself, following its instructions.</li>
            <li>If you’re not an EU citizen, check the visa requirements as soon as you’re admitted.</li>
          </ol>
          <p>
            More detail on each step is in our <PageLink view="guide">guide to studying medicine in Bulgaria</PageLink>.
          </p>
        </section>

        <FreeCheckCta onOpenQuickFit={onOpenQuickFit} universityId={g.id} />

        <section aria-labelledby="faq-title" className="space-y-4">
          <H2 id="faq-title">Questions about the {g.name}</H2>
          <FaqList faqs={g.faqs} />
        </section>

        <section aria-labelledby="others-title" className="space-y-3">
          <H2 id="others-title">Compare with the other universities</H2>
          <ul className="space-y-1.5">
            {others.map((s) => (
              <li key={s.id}>
                <PageLink view={universityView(s.id)}>{UNIVERSITY_GUIDES[universityView(s.id)].name}</PageLink>
              </li>
            ))}
          </ul>
        </section>
      </Prose>
    </article>
  );
};

/* -------------------------------------------------------------------------------------------- */

export const NotFoundView: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-4">
    <h1 className="text-3xl font-extrabold font-heading text-slate-900">Page not found</h1>
    <p className="text-slate-700">This address doesn’t match a page on StudyBg. Try one of these:</p>
    <ul className="list-disc pl-5 space-y-1.5 marker:text-[#006644]">
      <li><PageLink view="home">Homepage and free eligibility check</PageLink></li>
      <li><PageLink view="guide">How to study medicine in Bulgaria in English</PageLink></li>
      <li><PageLink view="universities">The four medical universities</PageLink></li>
      <li><PageLink view="calendar">Admissions calendar</PageLink></li>
    </ul>
  </div>
);
