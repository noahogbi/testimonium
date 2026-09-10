import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { archiveIndexPath, blobPath, readArchive, readBlob, writeArchive } from "../../src/archive/store.js";
import { buildArchiveEntry, type StagedEntry } from "../../src/archive/record.js";
import { ARCHIVE_VERSION, blobHash } from "../../src/archive/format.js";
import type { RawResponse, RungId } from "../../src/fetch/types.js";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "testimonium-archive-"));
  dirs.push(d);
  return join(d, "essay.archive");
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

// `date` is the VOLATILE header the node rung returns on every single response,
// and it is the reason the entry-equality predicate must ignore headers: one
// that compared them would never fire.
const read = (
  rung: RungId,
  rawBody: string,
  status = 200,
  date = "Wed, 09 Sep 2026 00:00:00 GMT",
): { rung: RungId; response: RawResponse } => ({
  rung,
  response: { rawBody, status, headers: { "content-type": "text/html", date }, finalUrl: "", bytes: rawBody.length },
});

// Built FROM buildArchiveEntry, never from a hand-written literal, so a change
// to the entry shape cannot leave these fixtures asserting a stale one.
interface StagedOver {
  archivedAt?: string;
  date?: string;
  toolVersion?: string;
}
function staged(bodies: string[], over: StagedOver = {}): StagedEntry {
  return buildArchiveEntry({
    verdict: "supported",
    claims: ["spending rose sharply"],
    reads: bodies.map((b, i) => read(i === 0 ? "node" : "curl", b, 200, over.date)),
    toolVersion: over.toolVersion ?? "0.1.0",
    localRulesHash: null,
    pdftotextVersion: null,
    archivedAt: over.archivedAt ?? "2026-09-09T00:00:00.000Z",
  });
}

const A = "https://e.com/report";
const B = "https://f.com/story";

function blobCount(dir: string): number {
  const root = join(dir, "blobs");
  if (!existsSync(root)) return 0;
  return readdirSync(root).reduce((n, shard) => n + readdirSync(join(root, shard)).length, 0);
}

describe("the archive store", () => {
  it("writes index.json with the version stamp and the entry under its key", () => {
    const dir = tmp();
    writeArchive(dir, new Map([[A, staged(["body one"])]]));
    const raw = JSON.parse(readFileSync(archiveIndexPath(dir), "utf8"));
    expect(raw.version).toBe(ARCHIVE_VERSION);
    expect(Object.keys(raw.urls)).toEqual([A]);
    expect(raw.urls[A].verdict).toBe("supported");
  });

  it("writes each blob gzipped at blobs/<aa>/<hash>.gz, and readBlob round-trips it", () => {
    const dir = tmp();
    const body = "the committee report says spending rose sharply";
    writeArchive(dir, new Map([[A, staged([body])]]));
    const h = blobHash(body);
    expect(blobPath(dir, h).endsWith(join("blobs", h.slice(0, 2), `${h}.gz`))).toBe(true);
    expect(existsSync(blobPath(dir, h))).toBe(true);
    expect(gunzipSync(readFileSync(blobPath(dir, h))).toString("utf8")).toBe(body);
    expect(readBlob(dir, h)).toBe(body);
  });

  it("MERGES: an entry for another URL survives a later write", () => {
    // The mutation this catches: writing `{ version, urls: staged }` instead of
    // overlaying onto what is already there. Under it, every check run that
    // fails one citation would delete that citation's baseline - on the exact
    // run the author needs it.
    const dir = tmp();
    writeArchive(dir, new Map([[A, staged(["body A"])]]));
    writeArchive(dir, new Map([[B, staged(["body B"])]]));
    const raw = JSON.parse(readFileSync(archiveIndexPath(dir), "utf8"));
    expect(Object.keys(raw.urls).sort()).toEqual([A, B].sort());
  });

  it("CHARACTERIZATION: re-archiving a URL overwrites its entry and ORPHANS the old blob - nothing prunes", () => {
    // Disclosed in spec 8.3: growth is monotonic in a committed store, orphans
    // are GC-able later because every live hash is named in index.json, and no
    // GC ships in plan 3. This test is what makes that disclosure attributable
    // to something other than a sentence.
    const dir = tmp();
    writeArchive(dir, new Map([[A, staged(["first body"])]]));
    writeArchive(dir, new Map([[A, staged(["second body"])]]));
    const raw = JSON.parse(readFileSync(archiveIndexPath(dir), "utf8"));
    expect(raw.urls[A].reads[0].hash).toBe(blobHash("second body"));
    expect(blobCount(dir)).toBe(2);
    expect(existsSync(blobPath(dir, blobHash("first body")))).toBe(true);
  });

  it("PRESERVES an entry that changed in nothing material: a new archivedAt AND a new date header leave index.json byte-identical", () => {
    // Fable's correction 1. The test this replaces was named "is idempotent"
    // and held `archivedAt` fixed in both writes over identical headers, so it
    // pinned blob content-addressing and COULD NOT detect the index churn its
    // name would lead a reader to think it ruled out - the plan-2 defect class,
    // a test that cannot test what it names. Both volatile fields are varied
    // here, because Task 6 stamps a fresh `archivedAt` on every run and node
    // returns a fresh `date` on every response.
    const dir = tmp();
    writeArchive(dir, new Map([[A, staged(["unchanged body"])]]));
    const first = readFileSync(archiveIndexPath(dir), "utf8");
    writeArchive(dir, new Map([[A, staged(["unchanged body"], {
      archivedAt: "2026-12-25T11:22:33.000Z",
      date: "Fri, 25 Dec 2026 11:22:33 GMT",
    })]]));
    expect(readFileSync(archiveIndexPath(dir), "utf8")).toBe(first);
    expect(blobCount(dir)).toBe(1);
  });

  it("NEGATIVE CONTROL: a materially changed entry IS rewritten, and carries the SECOND timestamp", () => {
    // Without this, `writeArchive` could preserve unconditionally - never
    // updating a baseline at all - and still pass the test above.
    const dir = tmp();
    writeArchive(dir, new Map([[A, staged(["unchanged body"])]]));
    const first = readFileSync(archiveIndexPath(dir), "utf8");
    writeArchive(dir, new Map([[A, staged(["a materially different body"], {
      archivedAt: "2026-12-25T11:22:33.000Z",
      date: "Fri, 25 Dec 2026 11:22:33 GMT",
    })]]));
    const after = readFileSync(archiveIndexPath(dir), "utf8");
    expect(after).not.toBe(first);
    const raw = JSON.parse(after);
    expect(raw.urls[A].archivedAt).toBe("2026-12-25T11:22:33.000Z");
    expect(raw.urls[A].reads[0].hash).toBe(blobHash("a materially different body"));
  });

  it("NEGATIVE CONTROL: a toolVersion bump is material, so the bundled-version note self-heals on the next green check", () => {
    // 8.3 names this case: the bundled rules are ours, a bump is recorded as a
    // likely cause of pipeline drift, and the entry must pick up the new
    // version rather than be preserved under the old one forever. The mutation
    // this catches: dropping `toolVersion` from the material list.
    const dir = tmp();
    writeArchive(dir, new Map([[A, staged(["unchanged body"])]]));
    writeArchive(dir, new Map([[A, staged(["unchanged body"], {
      toolVersion: "0.2.0",
      archivedAt: "2026-12-25T11:22:33.000Z",
    })]]));
    const raw = JSON.parse(readFileSync(archiveIndexPath(dir), "utf8"));
    expect(raw.urls[A].toolVersion).toBe("0.2.0");
    expect(raw.urls[A].archivedAt).toBe("2026-12-25T11:22:33.000Z");
    expect(blobCount(dir)).toBe(1);
  });

  it("writes nothing at all - not even a directory - when nothing was staged", () => {
    // `check` on a document whose every citation failed must leave no trace.
    const dir = tmp();
    writeArchive(dir, new Map());
    expect(existsSync(dir)).toBe(false);
  });

  it("writes the keys sorted, so a committed index diffs stably", () => {
    const dir = tmp();
    writeArchive(dir, new Map([[B, staged(["b"])], [A, staged(["a"])]]));
    const text = readFileSync(archiveIndexPath(dir), "utf8");
    expect(text.indexOf(`"${A}"`)).toBeLessThan(text.indexOf(`"${B}"`));
  });

  it("every hash named in the index exists on disk after a write", () => {
    // The ordering invariant: blobs are written BEFORE the index, so an
    // interrupted run never leaves an index naming a blob that is not there.
    const dir = tmp();
    writeArchive(dir, new Map([[A, staged(["one", "two"])]]));
    const raw = JSON.parse(readFileSync(archiveIndexPath(dir), "utf8"));
    for (const r of raw.urls[A].reads) expect(existsSync(blobPath(dir, r.hash))).toBe(true);
  });

  it("REFUSES to overwrite an index it cannot parse, and throws so the caller can warn", () => {
    const dir = tmp();
    mkdirSync(dir, { recursive: true });
    writeFileSync(archiveIndexPath(dir), "{ not json", "utf8");
    expect(() => writeArchive(dir, new Map([[A, staged(["body"])]]))).toThrow(/not valid JSON/);
    expect(readFileSync(archiveIndexPath(dir), "utf8")).toBe("{ not json");
  });

  it("REFUSES to overwrite an index stamped with a version it does not know", () => {
    const dir = tmp();
    mkdirSync(dir, { recursive: true });
    writeFileSync(archiveIndexPath(dir), JSON.stringify({ version: 99, urls: {} }), "utf8");
    expect(() => writeArchive(dir, new Map([[A, staged(["body"])]]))).toThrow(/version 99/);
  });

  it("readArchive reports an absent archive as absent, not as an error", () => {
    expect(readArchive(tmp())).toEqual({ kind: "absent" });
  });

  it("readArchive reports a corrupt index as unreadable, naming the path", () => {
    const dir = tmp();
    mkdirSync(dir, { recursive: true });
    writeFileSync(archiveIndexPath(dir), "{ not json", "utf8");
    const r = readArchive(dir);
    expect(r.kind).toBe("unreadable");
    if (r.kind === "unreadable") expect(r.reason).toContain("index.json");
  });

  it("readArchive returns the entries it parsed", () => {
    const dir = tmp();
    writeArchive(dir, new Map([[A, staged(["body one"])]]));
    const r = readArchive(dir);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(Object.keys(r.index.urls)).toEqual([A]);
      expect(r.index.urls[A]?.claimsHash).toHaveLength(64);
    }
  });
});
