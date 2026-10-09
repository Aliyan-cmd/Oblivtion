import type { Msg } from "./types";

export type WindowOptions = {
  maxMsgs?: number;
  minMsgs?: number;
  gapMs?: number;
  overlap?: number;
};

/** Split the chat where it pauses, with overlap at the boundaries. */
export function makeWindows(
  msgs: Msg[],
  { maxMsgs = 40, minMsgs = 15, gapMs = 3 * 60 * 60 * 1000, overlap = 5 }: WindowOptions = {},
): Msg[][] {
  const windows: Msg[][] = [];
  let current: Msg[] = [];

  for (const msg of msgs) {
    const tooMany = current.length >= maxMsgs;
    const bigGap =
      current.length >= minMsgs &&
      msg.ts.getTime() - current[current.length - 1].ts.getTime() > gapMs;

    if (tooMany || bigGap) {
      windows.push(current);
      current = current.slice(-overlap);
    }
    current.push(msg);
  }

  if (current.length) windows.push(current);
  return windows;
}
