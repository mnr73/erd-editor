/**
 * Rules for a file that changed outside the app. Pure, so the decisions are testable without a disk.
 *
 * A tab remembers the `stamp` ({ mtime, size }) of the file as last read or written by this app.
 * `check()` compares it with what is on disk now.
 */

export const DISK = Object.freeze({
    SAME: "same", // nothing to do
    CHANGED: "changed", // the file was changed by someone else
    GONE: "gone", // the file no longer exists
});

export const sameStamp = (a, b) =>
    !!a && !!b && a.mtime === b.mtime && a.size === b.size;

/** `known` = stamp we hold, `now` = stamp on disk (null = missing). */
export function diskState(known, now) {
    if (!known) return DISK.SAME; // never read from disk (unsaved tab): nothing to compare
    if (!now) return DISK.GONE;
    return sameStamp(known, now) ? DISK.SAME : DISK.CHANGED;
}

export const ACTION = Object.freeze({
    NONE: "none",
    RELOAD: "reload", // no unsaved work: take the disk version, quietly
    ASK: "ask", // unsaved work: show the banner, touch nothing
    GONE: "gone", // file deleted/moved: tell once
});

/**
 * What to do about a state. A reload is only silent when it cannot lose anything: the tab has no
 * unsaved changes. Otherwise nothing is written over the user's work. `dismissed` is the stamp the user
 * already chose to keep their version for: the same disk state never asks twice.
 */
export function decide({ state, dirty, now, dismissed }) {
    if (state === DISK.SAME) return ACTION.NONE;
    if (state === DISK.GONE)
        return dismissed === "gone" ? ACTION.NONE : ACTION.GONE;
    if (sameStamp(dismissed, now)) return ACTION.NONE;
    return dirty ? ACTION.ASK : ACTION.RELOAD;
}
