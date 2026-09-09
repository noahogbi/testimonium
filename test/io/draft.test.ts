import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDraft, draftInTheWay, draftNote, isHarvestNote, DRAFT_SENTENCE } from "../../src/io/draft.js";
import { parseClaimsFile } from "../../src/io/claims.js";

// Every file this suite writes lives under a fresh mkdtemp directory and is
// removed afterwards. A measurement earlier in this plan rewrote 22 tracked
// fixtures, so a test that writes anywhere but here is a defect.
const scratch: string[] = [];
const withFile = (contents: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "tstm-"));
  scratch.push(dir);
  const p = join(dir, "doc.claims.draft.json");
  writeFileSync(p, contents, "utf8");
  return p;
};
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const CLAIM = "the committee reported that spending rose sharply";

describe("the harvest draft file", () => {
  it("is keyed by the citation spelling, and carries the marker as _note", () => {
    const d = buildDraft({
      entries: [{ url: "https://e.com/a?utm_source=x", claims: [CLAIM] }],
      version: "0.1.0",
      date: "2026-09-08",
    });
    expect(Object.keys(d)).toEqual(["_note", "https://e.com/a?utm_source=x"]);
    expect(d["https://e.com/a?utm_source=x"]).toEqual([CLAIM]);
  });

  it("the marker names the version, the date and the sentence, in that order", () => {
    // Spec 8.2 step 6. The sentence is the whole point of the file: the
    // author is being shown what she COPIED, which is not always what she
    // CLAIMS, and only her confirmation turns a proposal into a claim.
    const note = draftNote("0.1.0", "2026-09-08");
    expect(note).toBe(`testimonium 0.1.0 harvest draft, 2026-09-08. ${DRAFT_SENTENCE}`);
    expect(DRAFT_SENTENCE).toBe(
      "every claim below is unconfirmed; harvest proposes what was copied, not what was meant",
    );
  });

  it("recognizes its own marker whatever version or date it carries", () => {
    // The deliberate reading of "byte-identical": every byte OUTSIDE the
    // version and the date must match. A literal reading would make
    // yesterday's draft un-overwritable today, which would make the command
    // unusable on its second day.
    expect(isHarvestNote(draftNote("0.1.0", "2026-09-08"))).toBe(true);
    expect(isHarvestNote(draftNote("0.9.3", "2027-01-02"))).toBe(true);
    expect(isHarvestNote(`${draftNote("0.1.0", "2026-09-08")} - reviewed by me`)).toBe(false);
    expect(isHarvestNote("my own notes about this file")).toBe(false);
    expect(isHarvestNote(undefined)).toBe(false);
  });

  it("lets harvest overwrite its own untouched draft", () => {
    const p = withFile(JSON.stringify({ _note: draftNote("0.1.0", "2026-09-07"), "https://e.com/a": [CLAIM] }));
    expect(draftInTheWay(p)).toBeNull();
  });

  it("refuses a draft the author has touched, naming the path and the remedy", () => {
    // "Never destroy author work" with no new flag (Fable Q6). A missing or
    // edited _note means she has been in this file.
    const edited = withFile(JSON.stringify({ _note: "mine now", "https://e.com/a": [CLAIM] }));
    const message = draftInTheWay(edited);
    expect(message).toContain(edited);
    expect(message).toContain("rename or delete");
    const missing = withFile(JSON.stringify({ "https://e.com/a": [CLAIM] }));
    expect(draftInTheWay(missing)).toContain("rename or delete");
    const garbage = withFile("not json at all");
    expect(draftInTheWay(garbage)).toContain("rename or delete");
    expect(draftInTheWay(join(tmpdir(), "tstm-no-such-file.claims.draft.json"))).toBeNull();
  });

  it("is a claims file the loader accepts once the author renames it, zero-claim URLs omitted", () => {
    // The draft's whole purpose is to be folded into <doc>.claims.json. If
    // parseClaimsFile refused its shape - the _note, the URL keys, the arrays
    // - the migration path would not exist (Fable F8).
    //
    // A readable source that shares nothing with the draft proposes zero, and
    // harvest() still reports it. Written as `"url": []` it would break the
    // migration on the ORDINARY case: parseClaimsFile refuses an empty array
    // with "claims must be a non-empty array of strings", so the rename would
    // exit 2 naming a key the author never wrote. buildDraft omits the key.
    // Same failure MODE F8 found - harvest's own output refused by the tool's
    // own loader - on a case F8 did not enumerate; it named the normalizing
    // key collision and the sub-floor claim, not the empty array.
    const d = buildDraft({
      entries: [
        { url: "https://e.com/a", claims: [CLAIM] },
        { url: "https://e.com/empty", claims: [] },
      ],
      version: "0.1.0",
      date: "2026-09-08",
    });
    expect(Object.keys(d)).not.toContain("https://e.com/empty");
    const parsed = parseClaimsFile(JSON.stringify(d));
    expect([...parsed.keys()]).toEqual(["https://e.com/a"]);
    expect(parsed.get("https://e.com/a")).toEqual([CLAIM]);
  });
});
