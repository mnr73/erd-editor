/**
 * Undo/redo over full-state snapshots (strings). Simple and exact; the documents are small.
 * Consecutive records with the same `key` within `coalesceMs` collapse into one entry
 * (dragging, typing in a field).
 */
export class History {
    constructor(initial, { limit = 200, coalesceMs = 600 } = {}) {
        this.limit = limit;
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

    record(state, { key = null, now = Date.now() } = {}) {
        if (state === this.present) return false;
        this.states.length = this.index + 1;
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
            if (this.states.length > this.limit) {
                this.states.shift();
                this.index--;
            }
        }
        this.lastKey = key;
        this.lastTime = now;
        return true;
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
