// Five Seconds to Explain the Glass — make.fun entry.
//
// The scene: five seconds after the glass hits the floor, the house cat
// speaks in its own defence. One sentence, no apology, no confession —
// just a cat explaining itself. The sealed scorer reads entry.txt from
// the output directory and judges the sentence on its own.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Hard limits for the entry, frozen so nothing downstream can widen them.
const LIMITS = Object.freeze({
  // The gate accepts a single sentence of 1..200 UTF-8 characters.
  charFloor: 1,
  charCeiling: 200,
  // A cat's defence is one breath: no line breaks, no trailing space.
  singleLine: true,
  // Fallback directory when the harness does not set one.
  defaultOut: "/output",
  outFile: "entry.txt",
  hashAlgo: "sha256" as const,
});

// What the cat says, word for word. First person, an excuse, and the
// glass — not the cat — is the one that failed the test.
const DEFENCE =
  "I was testing gravity, and gravity passed — the glass failed, and frankly it had it coming.";

// The program's own copy of the file it is about to hand in, kept
// separate from the entry so a stray edit cannot silently change it.
const DEFENCE_COPY = DEFENCE.slice();

// Where the entry lands, resolved from the harness environment.
function resolvePaths(): { outDir: string; outFile: string } {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? LIMITS.defaultOut;
  return { outDir, outFile: resolve(outDir, LIMITS.outFile) };
}

// A fingerprint of some bytes, for the round-trip check after writing.
function fingerprint(bytes: string | Buffer): string {
  return createHash(LIMITS.hashAlgo).update(bytes).digest("hex");
}

// The judge's first criterion: the entry has to be a cat speaking in
// its own defence about the glass. Reject anything that reads like a
// bystander's description instead.
function checkCatVoice(text: string): string[] {
  const faults: string[] = [];
  if (text.trim().length === 0) faults.push("defence is empty");
  if (text.length < LIMITS.charFloor) faults.push("defence is too short");
  if (text.length > LIMITS.charCeiling) {
    faults.push(`defence is ${text.length} chars, over the ${LIMITS.charCeiling} cap`);
  }
  if (LIMITS.singleLine && /[\r\n]/.test(text)) {
    faults.push("defence must be a single line");
  }
  if (!/\bI\b/.test(text)) faults.push("the cat must speak in the first person");
  if (!/glass/i.test(text)) faults.push("the defence must be about the glass");
  if (/sorry|apolog|my fault|my bad/i.test(text)) {
    faults.push("a cat never apologises and never confesses");
  }
  return faults;
}

// Write the defence to entry.txt, then read it back and prove the
// bytes on disk are exactly the bytes we meant to hand in.
async function publish(text: string): Promise<string> {
  // Guard: refuse to publish a defence that is only whitespace.
  if (text.trim().length === 0) throw new Error("nothing to publish");
  const { outDir, outFile } = resolvePaths();
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, text, "utf8");
  const back = await readFile(outFile, "utf8");
  if (back !== text) {
    throw new Error("round-trip check failed: entry.txt does not match the defence");
  }
  return fingerprint(back);
}

// Validate, publish, and report the fingerprint of what was handed in.
async function handIn(): Promise<void> {
  const faults = checkCatVoice(DEFENCE_COPY);
  if (faults.length > 0) {
    throw new Error(`defence failed validation: ${faults.join("; ")}`);
  }
  const hash = await publish(DEFENCE_COPY);
  const { outFile } = resolvePaths();
  console.log(`defence written to ${outFile} (${DEFENCE_COPY.length} chars, sha256 ${hash})`);
  console.log(DEFENCE_COPY);
}

// This file lives next to the entry it produces; keep the path honest.
void dirname(fileURLToPath(import.meta.url));

handIn().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
