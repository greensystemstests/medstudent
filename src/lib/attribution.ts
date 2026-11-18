/**
 * How this visit began (referring site, campaign tags, first page). Read once when the site loads and
 * held in memory only: nothing is written to the visitor's device. It is sent when they create their
 * account, so the team can see which channels bring students. Only the referrer's host is kept.
 */
export interface Attribution {
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  landing: string;
}

function capture(): Attribution | null {
  try {
    if (typeof window === "undefined") return null;
    const q = new URLSearchParams(window.location.search);
    let referrer = "";
    try {
      const host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
      // Moving around our own site isn't an arrival.
      referrer = host && host !== window.location.hostname.replace(/^www\./, "") ? host : "";
    } catch {
      referrer = "";
    }
    const a: Attribution = {
      referrer,
      utm_source: q.get("utm_source") ?? "",
      utm_medium: q.get("utm_medium") ?? "",
      utm_campaign: q.get("utm_campaign") ?? "",
      landing: window.location.pathname,
    };
    return a;
  } catch {
    return null;
  }
}

const arrival = capture();
export const getAttribution = (): Attribution | null => arrival;
