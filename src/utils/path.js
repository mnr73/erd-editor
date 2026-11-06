/** Split a file path (POSIX or Windows) into its directory (with trailing separator) and file name. */
export function splitPath(path) {
    if (!path) return { dir: "", name: "" };
    const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return { dir: path.slice(0, i + 1), name: path.slice(i + 1) };
}

/** Replace a leading home directory with `~` for display. */
export function shortenHome(dir, home) {
    return home && dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir;
}
