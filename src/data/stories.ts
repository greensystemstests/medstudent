/**
 * Student stories: short recordings from students, shown on the home page and on /student-stories/.
 * Add a story by adding a row here; `src`/`poster` are filled in when the media files are published.
 */
export type StoryKind = "video" | "audio";

export interface StudentStory {
  id: string;
  name: string;
  /** Shown right next to the name, so visitors see where students come from. */
  country: string;
  kind: StoryKind;
  durationSec: number;
  /** Their own words, quoted from the recording. Filled in once the recording has been reviewed. */
  quote?: string;
  src?: string;
  poster?: string;
}

export const STUDENT_STORIES: StudentStory[] = [
  { id: "nikolay-kolev", name: "Nikolay Kolev", country: "Greece", kind: "video", durationSec: 13 },
  { id: "maja-seib", name: "Maja Seib", country: "Germany", kind: "video", durationSec: 8 },
  { id: "maria-nicolova", name: "Maria Nicolova", country: "Ukraine", kind: "audio", durationSec: 19 },
  { id: "anna-gergana", name: "Anna Gergana", country: "Greece", kind: "audio", durationSec: 17 },
  { id: "nicole-sabag", name: "Nicole Sabag", country: "Cyprus", kind: "audio", durationSec: 36 },
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

export const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
