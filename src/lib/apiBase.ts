// Where the API lives. Production runs on Supabase (an Edge Function in the StudyBg.ac project).
// Local development leaves it empty so Vite proxies /api to the local server (npm run dev:server).
const SUPABASE_API = 'https://lexvesszfuqqrateocap.supabase.co/functions/v1/studybg';

const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const API_BASE = (configured ?? (import.meta.env.DEV ? '' : SUPABASE_API)).replace(/\/+$/, '');
