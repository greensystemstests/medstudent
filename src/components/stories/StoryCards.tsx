import React from "react";
import { Headphones, MapPin, Play, User } from "lucide-react";
import { formatDuration, StudentStory } from "../../data/stories";

/** Where the student is from, right next to their name. */
export const CountryChip: React.FC<{ country: string; className?: string }> = ({ country, className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#006644] text-xs font-semibold px-2 py-0.5 whitespace-nowrap ${className}`}
  >
    <MapPin className="w-3 h-3" aria-hidden="true" />
    {country}
  </span>
);

const QuoteLine: React.FC<{ story: StudentStory }> = ({ story }) => (
  <p className="text-sm text-slate-600 leading-relaxed">
    {story.quote ? (
      <>“{story.quote}”</>
    ) : (
      <span className="italic text-slate-400">“[Short quote from {story.name.split(" ")[0]}’s recording]”</span>
    )}
  </p>
);

/** Name and country on one line (wraps on narrow screens), then the quote. */
export const StoryByline: React.FC<{ story: StudentStory; quote?: boolean }> = ({ story, quote = true }) => (
  <div className="space-y-1.5">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <h3 className="font-heading font-bold text-slate-900 leading-tight">{story.name}</h3>
      <CountryChip country={story.country} />
    </div>
    {quote && <QuoteLine story={story} />}
  </div>
);

/**
 * Portrait (9:16) video tile. Nothing is downloaded until the visitor taps play: the tile is a poster
 * image with a play button, never an autoplaying video.
 */
export const VideoStoryCard: React.FC<{ story: StudentStory; onPlay?: () => void }> = ({ story, onPlay }) => (
  <article className="min-w-0">
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Play ${story.name}'s video story (${formatDuration(story.durationSec)})`}
      className="group relative block w-full aspect-[9/16] overflow-hidden rounded-2xl bg-[#0f1e36] border border-slate-200 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006644]"
    >
      {story.poster ? (
        <img src={story.poster} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f1e36] via-[#0b3a2d] to-[#006644]" aria-hidden="true">
          {/* Stand-in until the real poster frame (a still from the video) is added. */}
          <div className="absolute inset-x-0 top-[14%] flex flex-col items-center gap-2">
            <User className="w-20 h-20 text-white/15" strokeWidth={1.25} />
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" aria-hidden="true" />
      <span className="absolute top-3 left-3 rounded-full bg-black/55 text-white text-[0.6875rem] font-semibold px-2.5 py-1 backdrop-blur-sm">
        Video · {formatDuration(story.durationSec)}
      </span>
      <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className="w-16 h-16 rounded-full bg-white/95 shadow-lg flex items-center justify-center transition-transform group-hover:scale-105">
          <Play className="w-7 h-7 text-[#006644] translate-x-0.5" fill="currentColor" />
        </span>
      </span>
      <span className="absolute bottom-3 inset-x-3 text-left text-xs font-semibold text-white/90">Tap to watch</span>
    </button>
    <div className="mt-3">
      <StoryByline story={story} />
    </div>
  </article>
);

/** Audio clip: big play button, waveform, length. Nothing downloads until play is tapped. */
export const AudioStoryCard: React.FC<{ story: StudentStory; onPlay?: () => void; roomy?: boolean }> = ({
  story,
  onPlay,
  roomy = false,
}) => (
  <article className={`bg-white rounded-2xl border border-slate-200 shadow-xs ${roomy ? "p-5 sm:p-6" : "p-4"} flex items-start gap-4`}>
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Play ${story.name}'s audio story (${formatDuration(story.durationSec)})`}
      className="shrink-0 w-14 h-14 rounded-full bg-[#006644] hover:bg-[#005538] text-white flex items-center justify-center shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006644]"
    >
      <Play className="w-6 h-6 translate-x-0.5" fill="currentColor" aria-hidden="true" />
    </button>
    <div className="min-w-0 flex-1 space-y-2.5">
      <StoryByline story={story} quote={false} />
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="flex-1 flex items-center gap-[3px] h-7">
          {WAVE.map((h, i) => (
            <span key={i} className="flex-1 rounded-full bg-slate-200" style={{ height: `${h}%` }} />
          ))}
        </div>
        <span className="text-xs font-semibold text-slate-500 tabular-nums">{formatDuration(story.durationSec)}</span>
      </div>
      <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">
        <Headphones className="w-3.5 h-3.5" aria-hidden="true" /> Audio · tap to listen
      </p>
      <QuoteLine story={story} />
    </div>
  </article>
);

// Decorative bar heights (percent). Fixed, so the card looks identical on every load.
const WAVE = [30, 55, 40, 75, 50, 90, 60, 35, 70, 45, 80, 55, 30, 65, 85, 50, 40, 70, 35, 60, 45, 75, 30, 55];
