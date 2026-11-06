/**
 * Next highlighted index in a suggestion list of `count` items; -1 means "nothing highlighted"
 * (the typed text). ArrowDown from the last item goes back to -1, ArrowUp from -1 goes to the last.
 */
export function nextIndex(current, count, dir) {
    if (count <= 0) return -1;
    const next = current + dir;
    if (next >= count) return -1;
    if (next < -1) return count - 1;
    return next;
}
