// Only one student story plays at a time: starting one pauses whichever was playing.
let current: HTMLMediaElement | null = null;

export function claimPlayback(el: HTMLMediaElement) {
  if (current && current !== el) current.pause();
  current = el;
}

export function releasePlayback(el: HTMLMediaElement) {
  if (current === el) current = null;
}
