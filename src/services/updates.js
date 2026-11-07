import { useToast } from "@/composables/useToast";
import { i18n } from "@/i18n";
import { UPDATE, installNow, runUpdate } from "@/model/update";
import { confirmCloseAll } from "@/services/files";
import { useDocumentStore } from "@/stores/document";
import { checkForUpdate, isTauri, restartApp } from "@/tauri";

const t = (key, params) => i18n.global.t(key, params);

/** Never block or nag: an update problem must not get in the way of drawing. */
let running = false;

/**
 * Check for a new version, download it quietly and install it. Runs once when the app starts.
 * If boards have unsaved changes, the install waits and a toast offers "Restart now" (which
 * first asks about each unsaved board, like closing the window does).
 * `manual` is for the "Check for updates" button: it also reports "up to date" and errors.
 */
export async function autoUpdate({ manual = false } = {}) {
    if (!isTauri() || running) return null;
    running = true;
    const toast = useToast();
    const doc = useDocumentStore();
    try {
        const result = await runUpdate({
            check: checkForUpdate,
            hasUnsaved: () => doc.tabList.some((x) => x.dirty),
            restart: restartApp,
            onFound: ({ version }) => {
                if (manual)
                    toast.push({
                        kind: "info",
                        text: t("update.downloading", { version }),
                    });
            },
        });
        if (result.status === UPDATE.READY) {
            toast.push({
                kind: "success",
                timeout: 0,
                text: t("update.ready", { version: result.version }),
                action: {
                    label: t("update.restart"),
                    run: async () => {
                        // same prompts as closing the window: save / discard / cancel per board
                        if (await confirmCloseAll()) {
                            await installNow(result.update, restartApp);
                        }
                    },
                },
            });
        } else if (manual && result.status === UPDATE.NONE) {
            toast.push({ kind: "success", text: t("update.upToDate") });
        } else if (manual && result.status === UPDATE.FAILED) {
            toast.push({
                kind: "error",
                text: t("update.failed", { reason: result.error }),
            });
        }
        return result;
    } finally {
        running = false;
    }
}
