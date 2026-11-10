import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { GATEWAY_NAME, ONBOARDING_FEE_EUR } from "../../data/constants";
import { AUDIO_STORIES, STORY_COUNTRIES, VIDEO_STORIES } from "../../data/stories";
import { pathFor } from "../../lib/routes";
import { AudioStoryCard, CountryChip, VideoStoryCard } from "../stories/StoryCards";
import { CountryStrip, StoriesDisclaimer } from "../stories/StudentStoriesSection";

interface Props {
  onOpenQuickFit: () => void;
}

/** /student-stories/: every story in one place, then the same single next step as the rest of the site. */
export const StudentStoriesPage: React.FC<Props> = ({ onOpenQuickFit }) => (
  <div className="bg-[#F8FAFC]">
    <header className="bg-gradient-to-b from-[#0f1e36] to-[#00281b] text-white px-4 sm:px-6 lg:px-8 pt-8 pb-10">
      <div className="max-w-4xl mx-auto space-y-4">
        <nav aria-label="Breadcrumb" className="text-xs text-slate-300">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li className="flex items-center gap-1.5">
              <a href={pathFor("home")} className="underline underline-offset-2 hover:text-white">
                Home
              </a>
              <span aria-hidden="true">/</span>
            </li>
            <li aria-current="page" className="text-white">
              Student stories
            </li>
          </ol>
        </nav>
        <h1 className="text-3xl sm:text-4xl font-extrabold font-heading tracking-tight leading-tight text-balance">What students say about us</h1>
        <p className="text-base text-slate-300 leading-relaxed max-w-3xl">
          No brochure talk. Just students from Greece, Germany, Ukraine and Cyprus, in their own voices. Watch two. Listen to three. Then
          decide if you want to be next.
        </p>
        <CountryStrip onDark />
      </div>
    </header>

    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      <section aria-labelledby="watch-title" className="space-y-4">
        <h2 id="watch-title" className="text-xl sm:text-2xl font-extrabold font-heading text-slate-900">
          Watch
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:gap-8 max-w-2xl">
          {VIDEO_STORIES.map((story) => (
            <VideoStoryCard key={story.id} story={story} />
          ))}
        </div>
      </section>

      <section aria-labelledby="listen-title" className="space-y-4">
        <h2 id="listen-title" className="text-xl sm:text-2xl font-extrabold font-heading text-slate-900">
          Listen
        </h2>
        <div className="space-y-3">
          {AUDIO_STORIES.map((story) => (
            <AudioStoryCard key={story.id} story={story} roomy />
          ))}
        </div>
      </section>

      <section aria-labelledby="from-title" className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-3">
        <h2 id="from-title" className="text-xl font-extrabold font-heading text-slate-900">
          Students come from all over
        </h2>
        <div className="flex flex-wrap gap-2">
          {STORY_COUNTRIES.map(({ country, count }) => (
            <CountryChip key={country} country={count > 1 ? `${country} · ${count} stories` : country} />
          ))}
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Different passports and different school systems mean different documents and different steps. Sorting that out is exactly what the
          free eligibility check is for.
        </p>
      </section>

      <StoriesDisclaimer />

      <section aria-labelledby="stories-cta-title" className="rounded-2xl bg-[#0f1e36] text-white p-6 sm:p-8">
        <h2 id="stories-cta-title" className="text-xl sm:text-2xl font-extrabold font-heading">
          Wondering if you’d be next?
        </h2>
        <p className="text-slate-300 mt-2 text-sm sm:text-base">
          Find out in about two minutes. Five questions, no sign-up and no payment. You get a list of what looks ready, what needs
          checking, and a link to the official requirements.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onOpenQuickFit}
            className="min-h-11 px-6 py-3 bg-[#00a86b] hover:bg-[#00bf7a] text-[#04150f] font-bold rounded-xl text-sm inline-flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            Check your eligibility — Free
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
    </div>
  </div>
);
