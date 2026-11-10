import { shallowRef } from "vue";

/**
 * What the disk watcher found for each tab that needs the user: `{ [tabId]: "changed" | "gone" }`.
 * Read by <AppDiskBanner>; written by services/disk.js.
 */
const warnings = shallowRef({});

export const useDiskWarnings = () => warnings;

export function setDiskWarning(tabId, kind) {
    if (warnings.value[tabId] === kind) return;
    const next = { ...warnings.value };
    if (kind) next[tabId] = kind;
    else delete next[tabId];
    warnings.value = next;
}
