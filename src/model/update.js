/**
 * Self-update flow, split from Tauri so it can be tested: `runUpdate` takes the plugin calls as
 * arguments and returns what happened. Nothing here throws; every failure becomes a result.
 *
 * Why the update waits for unsaved work: installing restarts the app, and a restart would drop
 * boards that were never saved. So the check and the download run silently, but the final
 * "install and restart" only happens when no board has unsaved changes.
 */

/** Result codes of `runUpdate`. */
export const UPDATE = {
    NONE: "none", // already on the latest version
    INSTALLED: "installed", // downloaded and installed; the app restarts (or is about to)
    READY: "ready", // downloaded, waiting for unsaved boards to be saved
    FAILED: "failed", // offline, no release yet, bad signature, ...
};

/**
 * @param {object} io
 * @param {() => Promise<object|null>} io.check   plugin `check()`; null when up to date
 * @param {() => boolean} io.hasUnsaved           any board with unsaved changes?
 * @param {() => Promise<void>} io.restart        plugin `relaunch()`
 * @param {(info: {version: string, notes: string}) => void} [io.onFound]
 * @returns {Promise<{status: string, version?: string, error?: string, update?: object}>}
 */
export async function runUpdate({ check, hasUnsaved, restart, onFound }) {
    let update;
    try {
        update = await check();
    } catch (e) {
        return { status: UPDATE.FAILED, error: String(e?.message ?? e) };
    }
    if (!update) return { status: UPDATE.NONE };
    onFound?.({ version: update.version, notes: update.body ?? "" });
    try {
        await update.download();
    } catch (e) {
        return {
            status: UPDATE.FAILED,
            version: update.version,
            error: String(e?.message ?? e),
        };
    }
    if (hasUnsaved()) {
        return { status: UPDATE.READY, version: update.version, update };
    }
    return installNow(update, restart);
}

/** Install a downloaded update and restart. Used directly when the user has saved in the meantime. */
export async function installNow(update, restart) {
    try {
        await update.install();
        await restart();
        return { status: UPDATE.INSTALLED, version: update.version };
    } catch (e) {
        return {
            status: UPDATE.FAILED,
            version: update.version,
            error: String(e?.message ?? e),
        };
    }
}
