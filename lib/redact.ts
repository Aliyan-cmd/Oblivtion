import type { Msg } from "./types";

const PHONE = /\+?\d[\d\s-]{8,}\d/g;

export type Redaction = {
  redact: (text: string | null) => string;
  labels: Record<string, string>;
};

function label(index: number): string {
  return `Person ${index < 26 ? String.fromCharCode(65 + index) : index}`;
}

/** Replace sender names and phone numbers with stable labels. */
export function buildRedactor(msgs: Msg[]): Redaction {
  const senders = [...new Set(msgs.map((m) => m.sender))];
  const labels: Record<string, string> = {};
  senders.forEach((sender, i) => {
    labels[sender] = label(i);
  });

  const patterns: { re: RegExp; to: string }[] = [];
  for (const [sender, replacement] of Object.entries(labels)) {
    patterns.push({
      re: new RegExp(sender.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      to: replacement,
    });
    const first = sender.split(/\s+/)[0] || "";
    if (/^[A-Za-z]+$/.test(first) && first.length >= 3) {
      patterns.push({
        re: new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"),
        to: replacement,
      });
    }
  }
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);

  const redact = (text: string | null): string => {
    let out = text ?? "";
    out = out.replace(PHONE, "[phone]");
    for (const { re, to } of patterns) out = out.replace(re, to);
    return out;
  };

  return { redact, labels };
}
