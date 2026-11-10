import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Headphones, Loader2, MapPin, Pause, Play, RotateCcw } from "lucide-react";
import { formatDuration, StudentStory } from "../../data/stories";
import { claimPlayback, releasePlayback } from "../../lib/mediaRegistry";

/** Where the student is from, right next to their name. */
export const CountryChip: React.FC<{ country: string; className?: string }> = ({ country, className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#006644] text-xs font-semibold px-2 py-0.5 whitespace-nowrap ${className}`}
  >
    <MapPin className="w-3 h-3" aria-hidden="true" />
    {country}
  </span>
);

/** Name and country on one line (wraps on narrow screens). */
export const StoryByline: React.FC<{ story: StudentStory }> = ({ story }) => (
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
    <h3 className="font-heading font-bold text-slate-900 leading-tight">{story.name}</h3>
    <CountryChip country={story.country} />
  </div>
);

type PlayState = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

/* -------------------------------------------------------------------------------------------- */
/* Video                                                                                         */
/* -------------------------------------------------------------------------------------------- */

/**
 * Portrait (9:16) video tile. Before play it is just the student's face (a small poster image) with
 * the play button at the bottom, so the face is never covered. Nothing else is downloaded until the
 * visitor taps; the video never autoplays. While it loads, the face stays on screen.
 */
export const VideoStoryCard: React.FC<{ story: StudentStory }> = ({ story }) => {
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<PlayState>("idle");
  const ref = useRef<HTMLVideoElement>(null);
  const first = story.name.split(" ")[0];

  useEffect(() => {
    const el = ref.current;
    if (!started || !el) return;
    el.play().catch((e) => {
      // Blocked by the browser: leave the controls for the visitor. Real failures arrive as media errors.
      if (e?.name === "NotAllowedError") setState("paused");
    });
    return () => releasePlayback(el);
  }, [started]);

  const start = () => {
    setState("loading");
    setStarted(true);
  };
  const retry = () => {
    const el = ref.current;
    setState("loading");
    if (el) {
      el.load();
      el.play().catch(() => {});
    } else setStarted(true);
  };

  return (
    <article className="min-w-0">
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-[#0f1e36] border border-slate-200 shadow-sm">
        {story.poster && (
          <img
            src={story.poster}
            alt={`${story.name}, ${story.country}`}
            width={540}
            height={960}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {started && (
          <video
            ref={ref}
            className="absolute inset-0 w-full h-full object-cover bg-black"
            poster={story.poster}
            controls
            playsInline
            preload="auto"
            aria-label={`${story.name}'s video story`}
            onPlay={(e) => claimPlayback(e.currentTarget)}
            onPlaying={() => setState("playing")}
            onWaiting={() => setState("loading")}
            onCanPlay={(e) => e.currentTarget.paused && setState((s) => (s === "loading" ? "paused" : s))}
            onPause={(e) => !e.currentTarget.ended && setState((s) => (s === "error" ? s : "paused"))}
            onEnded={() => setState("ended")}
            onError={() => setState("error")}
          >
            {story.sources.map((s, i) => (
              <source
                key={s.src}
                src={s.src}
                type={s.type}
                onError={i === story.sources.length - 1 ? () => setState("error") : undefined}
              />
            ))}
          </video>
        )}

        {!started && (
          <button
            type="button"
            onClick={start}
            aria-label={`Play ${story.name}'s video story from ${story.country} (${formatDuration(story.durationSec)})`}
            className="group absolute inset-0 text-left focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
          >
            <span className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" aria-hidden="true" />
            <span className="absolute left-3 bottom-3 flex items-center gap-2.5 text-white" aria-hidden="true">
              <span className="w-12 h-12 rounded-full bg-white/95 shadow-lg flex items-center justify-center transition-transform group-hover:scale-105">
                <Play className="w-5 h-5 text-[#006644] translate-x-0.5" fill="currentColor" />
              </span>
              <span className="leading-tight drop-shadow">
                <span className="block text-sm font-bold">Watch</span>
                <span className="block text-xs font-medium text-white/85 tabular-nums">{formatDuration(story.durationSec)}</span>
              </span>
            </span>
          </button>
        )}

        {started && state === "loading" && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/25" role="status" aria-live="polite">
            <span className="flex items-center gap-2 rounded-full bg-black/60 text-white text-xs font-semibold px-3 py-1.5">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading {first}’s video…
            </span>
          </div>
        )}

        {state === "error" && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0f1e36]/90 p-4 text-center text-white">
            <AlertCircle className="w-7 h-7 text-amber-300" aria-hidden="true" />
            <p className="text-sm font-semibold">This video couldn’t play right now.</p>
            <button
              type="button"
              onClick={retry}
              className="min-h-11 px-4 py-2 rounded-xl bg-white text-[#006644] text-sm font-bold inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" /> Try again
            </button>
          </div>
        )}
      </div>
      <div className="mt-3">
        <StoryByline story={story} />
      </div>
    </article>
  );
};

/* -------------------------------------------------------------------------------------------- */
/* Audio                                                                                         */
/* -------------------------------------------------------------------------------------------- */

// Decorative bar heights (percent). Fixed, so the card looks identical on every load.
const WAVE = [30, 55, 40, 75, 50, 90, 60, 35, 70, 45, 80, 55, 30, 65, 85, 50, 40, 70, 35, 60, 45, 75, 30, 55];

/**
 * Audio clip: big play/pause button, a waveform that fills as it plays (also the seek bar), and the
 * time. The file is only requested when the visitor first taps play.
 */
export const AudioStoryCard: React.FC<{ story: StudentStory; roomy?: boolean }> = ({ story, roomy = false }) => {
  const ref = useRef<HTMLAudioElement>(null);
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<PlayState>("idle");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(story.durationSec);
  const first = story.name.split(" ")[0];

  // Start playing as soon as the audio element exists (that only happens after the first tap).
  useEffect(() => {
    const el = ref.current;
    if (!started || !el) return;
    el.play().catch((e) => {
      if (e?.name === "NotAllowedError") setState("paused");
    });
    return () => releasePlayback(el);
  }, [started]);

  const toggle = () => {
    const el = ref.current;
    if (!started) {
      setState("loading");
      setStarted(true);
      return;
    }
    if (!el) return;
    if (state === "error") {
      setState("loading");
      el.load();
      el.play().catch(() => {});
    } else if (state === "ended") {
      el.currentTime = 0;
      el.play().catch(() => {});
    } else if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  const progress = duration > 0 ? Math.min(1, time / duration) : 0;
  const filledBars = Math.round(progress * WAVE.length);
  const label =
    state === "playing" ? "Pause" : state === "ended" ? "Play again" : state === "error" ? "Try again" : "Play";

  return (
    <article className={`bg-white rounded-2xl border border-slate-200 shadow-xs ${roomy ? "p-5 sm:p-6" : "p-4"} flex items-start gap-4`}>
      <button
        type="button"
        onClick={toggle}
        aria-label={`${label} ${story.name}'s audio story from ${story.country}`}
        className="shrink-0 w-14 h-14 rounded-full bg-[#006644] hover:bg-[#005538] text-white flex items-center justify-center shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006644]"
      >
        {state === "loading" ? (
          <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
        ) : state === "playing" ? (
          <Pause className="w-6 h-6" fill="currentColor" aria-hidden="true" />
        ) : state === "ended" || state === "error" ? (
          <RotateCcw className="w-6 h-6" aria-hidden="true" />
        ) : (
          <Play className="w-6 h-6 translate-x-0.5" fill="currentColor" aria-hidden="true" />
        )}
      </button>

      <div className="min-w-0 flex-1 space-y-2.5">
        <StoryByline story={story} />

        <div className="flex items-center gap-3">
          <div className="relative flex-1 h-9 flex items-center gap-[3px] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#006644] rounded">
            {WAVE.map((h, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`flex-1 rounded-full transition-colors ${i < filledBars ? "bg-[#006644]" : "bg-slate-200"}`}
                style={{ height: `${h}%` }}
              />
            ))}
            {started && (
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={time}
                aria-label={`Seek in ${story.name}'s audio`}
                onChange={(e) => {
                  const el = ref.current;
                  if (el) el.currentTime = Number(e.target.value);
                  setTime(Number(e.target.value));
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            )}
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums shrink-0">
            {started ? `${formatDuration(time)} / ` : ""}
            {formatDuration(duration)}
          </span>
        </div>

        <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">
          <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
          {state === "loading"
            ? `Loading ${first}’s clip…`
            : state === "playing"
              ? "Playing"
              : state === "error"
                ? "Audio · couldn’t play, tap to retry"
                : "Audio · tap to listen"}
        </p>
        {state === "error" && (
          <p role="alert" className="text-xs text-red-700">
            This clip couldn’t play right now. Check your connection and try again.
          </p>
        )}
      </div>

      {started && (
        <audio
          ref={ref}
          preload="auto"
          onPlay={(e) => claimPlayback(e.currentTarget)}
          onPlaying={() => setState("playing")}
          onWaiting={() => setState("loading")}
          onCanPlay={(e) => e.currentTarget.paused && setState((s) => (s === "loading" ? "paused" : s))}
          onPause={(e) => !e.currentTarget.ended && setState((s) => (s === "error" ? s : "paused"))}
          onEnded={() => setState("ended")}
          onError={() => setState("error")}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        >
          {story.sources.map((s, i) => (
            <source
              key={s.src}
              src={s.src}
              type={s.type}
              onError={i === story.sources.length - 1 ? () => setState("error") : undefined}
            />
          ))}
        </audio>
      )}
    </article>
  );
};
