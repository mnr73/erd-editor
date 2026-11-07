/**
 * Undo/redo over full-state snapshots (strings). Simple and exact; the documents are small.
 * Consecutive records with the same `key` within `coalesceMs` collapse into one entry
 * (dragging, typing in a field).
 *
 * Depth: `limit` states (default 501 = 500 undo steps), but never more than `maxChars` of snapshot text in total, so a huge
 * board cannot eat memory (200 steps of a 1 MB file would be 200 MB). The oldest steps go first and
 * at least `minKeep` steps always stay, however big the file is.
 */
export class History {
    constructor(
        initial,
        {
            limit = 501,
            coalesceMs = 600,
            maxChars = 40_000_000,
            minKeep = 20,
        } = {},
    ) {
        this.limit = limit;
        this.maxChars = maxChars;
        this.minKeep = minKeep;
        this.coalesceMs = coalesceMs;
        this.reset(initial);
    }

    reset(initial) {
        this.states = [initial];
        this.index = 0;
        this.lastKey = null;
        this.lastTime = 0;
    }

    get present() {
        return this.states[this.index];
    }
    get canUndo() {
        return this.index > 0;
    }
    get canRedo() {
        return this.index < this.states.length - 1;
    }

    /**
     * `amend: true` folds this change into the current entry instead of adding a new one
     * (e.g. naming a column that was just created = one undo step for "create + name").
     */
    record(state, { key = null, now = Date.now(), amend = false } = {}) {
        if (state === this.present) return false;
        this.states.length = this.index + 1;
        if (amend && this.index > 0) {
            this.states[this.index] = state;
            this.lastKey = null;
            return true;
        }
        const coalesce =
            key !== null &&
            key === this.lastKey &&
            now - this.lastTime < this.coalesceMs &&
            this.index > 0;
        if (coalesce) {
            this.states[this.index] = state;
        } else {
            this.states.push(state);
            this.index++;
        }
        this.trim();
        this.lastKey = key;
        this.lastTime = now;
        return true;
    }

    /** Drop the oldest steps while over the count limit or the memory budget. */
    trim() {
        let chars = 0;
        for (const s of this.states) chars += s.length;
        while (
            this.index > 0 &&
            (this.states.length > this.limit ||
                (chars > this.maxChars && this.states.length > this.minKeep))
        ) {
            chars -= this.states.shift().length;
            this.index--;
        }
    }

    /** Number of steps that can be undone / redone (for tooltips). */
    get undoSteps() {
        return this.index;
    }
    get redoSteps() {
        return this.states.length - 1 - this.index;
    }

    undo() {
        if (!this.canUndo) return null;
        this.lastKey = null;
        return this.states[--this.index];
    }

    redo() {
        if (!this.canRedo) return null;
        this.lastKey = null;
        return this.states[++this.index];
    }
}
