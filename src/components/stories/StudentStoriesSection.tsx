import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { AUDIO_STORIES, STORY_COUNTRIES, STUDENT_STORIES, VIDEO_STORIES } from "../../data/stories";

const COUNT_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);
import { pathFor } from "../../lib/routes";
import { AudioStoryCard, CountryChip, VideoStoryCard } from "./StoryCards";

/** Where the story-count line sits: shown on the home page and the stories page. */
export const CountryStrip: React.FC<{ onDark?: boolean }> = ({ onDark = false }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className={`text-xs font-semibold uppercase tracking-wide ${onDark ? "text-slate-300" : "text-slate-500"}`}>
      Students from
    </span>
    {STORY_COUNTRIES.map(({ country }) => (
      <CountryChip key={country} country={country} />
    ))}
  </div>
);

/** Fine print that goes next to any testimonial: honest about what a story is. */
export const StoriesDisclaimer: React.FC<{ className?: string }> = ({ className = "" }) => (
  <p className={`text-xs text-slate-500 ${className}`}>
    Individual experiences, in the students’ own voices. StudyBg doesn’t guarantee admission: universities make their own decisions.
  </p>
);

interface Props {
  onOpenQuickFit: () => void;
}

/**
 * Home-page section, placed after "How it works" and before the price: the reader has just seen the
 * process, and now hears from people who went through it, right before being asked to decide.
 * Media is tap-to-play only (see StoryCards).
 */
export const StudentStoriesSection: React.FC<Props> = ({ onOpenQuickFit }) => (
  <section
    id="stories-section"
    aria-labelledby="stories-title"
    className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
  >
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#006644] text-xs font-bold px-3 py-1">
          Real students · Real voices
        </p>
        <h2 id="stories-title" className="mt-3 text-2xl sm:text-3xl font-extrabold font-heading text-slate-900">
          What students say about us
        </h2>
        <p className="text-slate-600 mt-2 leading-relaxed">
          Here’s the thing about admissions help: everybody says they’re great at it. So don’t take our word for it. Take theirs.{" "}
          {countWord(STUDENT_STORIES.length)} students, {countWord(STORY_COUNTRIES.length).toLowerCase()} countries, no script and no fancy
          editing. Press play and hear it from them.
        </p>
      </div>
      <CountryStrip />
    </div>

    <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className={VIDEO_STORIES.length > 2 ? "lg:col-span-7" : "lg:col-span-5"}>
        <div
          role="group"
          aria-label="Video stories"
          className={`-mx-4 px-4 sm:mx-0 sm:px-0 flex sm:grid ${VIDEO_STORIES.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-4 overflow-x-auto sm:overflow-visible snap-x snap-mandatory scroll-px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          {VIDEO_STORIES.map((story) => (
            <div key={story.id} className="snap-start shrink-0 w-[64%] max-w-[260px] sm:w-auto sm:max-w-none">
              <VideoStoryCard story={story} />
            </div>
          ))}
        </div>
      </div>

      <div className={`${VIDEO_STORIES.length > 2 ? "lg:col-span-5" : "lg:col-span-7"} space-y-3`} role="group" aria-label="Audio stories">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Or just listen</p>
        {AUDIO_STORIES.map((story) => (
          <AudioStoryCard key={story.id} story={story} />
        ))}
      </div>
    </div>

    <div className="mt-8 rounded-2xl bg-emerald-50 border border-emerald-200 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <p className="font-heading font-bold text-lg text-slate-900">Wondering if that could be you?</p>
        <p className="text-sm text-slate-700 mt-0.5">Find out in about two minutes. Five questions, no sign-up, no payment.</p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:shrink-0">
        <button
          type="button"
          onClick={onOpenQuickFit}
          className="min-h-11 px-6 py-3 bg-[#006644] hover:bg-[#005538] text-white font-bold rounded-xl text-sm inline-flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          Check your eligibility — Free
        </button>
        <a
          href={pathFor("stories")}
          className="min-h-11 px-2 py-2 text-sm font-semibold text-[#006644] underline underline-offset-2 inline-flex items-center justify-center gap-1"
        >
          Hear every story
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
    <StoriesDisclaimer className="mt-3" />
  </section>
);
