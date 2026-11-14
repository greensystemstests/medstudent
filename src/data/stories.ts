/**
 * Student stories: short recordings from students, shown on the home page and on /student-stories/.
 * Add a story by adding a row here and dropping its files into public/stories/.
 * Files are loaded only when a visitor taps play (the poster image is the only thing fetched up front).
 */
export type StoryKind = "video" | "audio";

export interface MediaSource {
  src: string;
  type: string;
}

export interface StudentStory {
  id: string;
  name: string;
  /** Shown right next to the name, so visitors see where students come from. */
  country: string;
  kind: StoryKind;
  durationSec: number;
  /** Tried in order; the browser plays the first format it supports. */
  sources: MediaSource[];
  /** Video only: a still of the student's face, shown before play. */
  poster?: string;
}

const video = (slug: string): MediaSource[] => [
  { src: `/stories/${slug}.mp4`, type: "video/mp4" },
  { src: `/stories/${slug}.webm`, type: "video/webm" },
];
const audio = (slug: string): MediaSource[] => [{ src: `/stories/${slug}.mp3`, type: "audio/mpeg" }];

export const STUDENT_STORIES: StudentStory[] = [
  { id: "nikolay-kolev", name: "Nikolay Kolev", country: "Greece", kind: "video", durationSec: 13, sources: video("nikolay-kolev"), poster: "/stories/nikolay-kolev.jpg" },
  { id: "maja-seib", name: "Maja Seib", country: "Germany", kind: "video", durationSec: 8, sources: video("maja-seib"), poster: "/stories/maja-seib.jpg" },
  { id: "dimana-krumova", name: "Dimana Krumova", country: "Turkey", kind: "video", durationSec: 15, sources: video("dimana-krumova"), poster: "/stories/dimana-krumova.jpg" },
  { id: "maria-nicolova", name: "Maria Nicolova", country: "Ukraine", kind: "audio", durationSec: 19, sources: audio("maria-nicolova") },
  { id: "anna-gergana", name: "Anna Gergana", country: "Greece", kind: "audio", durationSec: 17, sources: audio("anna-gergana") },
  { id: "nicole-sabag", name: "Nicole Sabag", country: "Cyprus", kind: "audio", durationSec: 36, sources: audio("nicole-sabag") },
];

export const VIDEO_STORIES = STUDENT_STORIES.filter((s) => s.kind === "video");
export const AUDIO_STORIES = STUDENT_STORIES.filter((s) => s.kind === "audio");

/** Countries represented, with how many stories each, in order of first appearance. */
export const STORY_COUNTRIES = STUDENT_STORIES.reduce<{ country: string; count: number }[]>((acc, s) => {
  const hit = acc.find((c) => c.country === s.country);
  if (hit) hit.count += 1;
  else acc.push({ country: s.country, count: 1 });
  return acc;
}, []);

export const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
