import { VERSION } from "./constants";

export class ErdFileError extends Error {
    constructor(code, details = {}) {
        super(code);
        this.code = code;
        this.details = details;
    }
}

/**
 * migrations[n] upgrades a document from version n to n + 1 (mutates + returns it).
 * Keep old steps forever; they are what lets old files open.
 */
export const migrations = {
    // 1: (doc) => { ...; doc.version = 2; return doc; },
};

/** Returns a deep copy upgraded to the current version. Throws ErdFileError. */
export function migrate(raw) {
    const version = raw.version;
    if (!Number.isInteger(version) || version < 1) {
        throw new ErdFileError("bad-version", { found: version });
    }
    if (version > VERSION) {
        throw new ErdFileError("newer-version", {
            found: version,
            supported: VERSION,
        });
    }
    let doc = structuredClone(raw);
    while (doc.version < VERSION) {
        const step = migrations[doc.version];
        if (!step)
            throw new ErdFileError("missing-migration", { from: doc.version });
        doc = step(doc);
    }
    return doc;
}
