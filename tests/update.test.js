import { describe, expect, it, vi } from "vitest";

import { UPDATE, installNow, runUpdate } from "@/model/update";

const fakeUpdate = (over = {}) => ({
    version: "1.2.0",
    body: "notes",
    download: vi.fn(async () => {}),
    install: vi.fn(async () => {}),
    ...over,
});
const io = (over = {}) => ({
    check: async () => null,
    hasUnsaved: () => false,
    restart: vi.fn(async () => {}),
    ...over,
});

describe("runUpdate", () => {
    it("does nothing when already up to date", async () => {
        const r = await runUpdate(io());
        expect(r).toEqual({ status: UPDATE.NONE });
    });

    it("downloads, installs and restarts when nothing is unsaved", async () => {
        const u = fakeUpdate();
        const o = io({ check: async () => u });
        const found = vi.fn();
        const r = await runUpdate({ ...o, onFound: found });
        expect(r).toEqual({ status: UPDATE.INSTALLED, version: "1.2.0" });
        expect(found).toHaveBeenCalledWith({
            version: "1.2.0",
            notes: "notes",
        });
        expect(u.download).toHaveBeenCalledOnce();
        expect(u.install).toHaveBeenCalledOnce();
        expect(o.restart).toHaveBeenCalledOnce();
    });

    it("downloads but does NOT install or restart while boards are unsaved", async () => {
        const u = fakeUpdate();
        const o = io({ check: async () => u, hasUnsaved: () => true });
        const r = await runUpdate(o);
        expect(r.status).toBe(UPDATE.READY);
        expect(r.version).toBe("1.2.0");
        expect(u.download).toHaveBeenCalledOnce();
        expect(u.install).not.toHaveBeenCalled();
        expect(o.restart).not.toHaveBeenCalled();
        // later, after saving, the user restarts: now it installs
        const done = await installNow(r.update, o.restart);
        expect(done.status).toBe(UPDATE.INSTALLED);
        expect(u.install).toHaveBeenCalledOnce();
        expect(o.restart).toHaveBeenCalledOnce();
    });

    it("an offline or broken check is a result, never an exception", async () => {
        const r = await runUpdate(
            io({
                check: async () => {
                    throw new Error("network down");
                },
            }),
        );
        expect(r).toEqual({ status: UPDATE.FAILED, error: "network down" });
        const s = await runUpdate(
            io({
                check: async () => {
                    throw "plain string";
                },
            }),
        );
        expect(s.error).toBe("plain string");
    });

    it("a failed download never installs or restarts", async () => {
        const u = fakeUpdate({
            download: async () => {
                throw new Error("bad signature");
            },
        });
        const o = io({ check: async () => u });
        const r = await runUpdate(o);
        expect(r.status).toBe(UPDATE.FAILED);
        expect(r.error).toBe("bad signature");
        expect(u.install).not.toHaveBeenCalled();
        expect(o.restart).not.toHaveBeenCalled();
    });

    it("a failed install does not restart", async () => {
        const u = fakeUpdate({
            install: async () => {
                throw new Error("disk full");
            },
        });
        const o = io({ check: async () => u });
        const r = await runUpdate(o);
        expect(r.status).toBe(UPDATE.FAILED);
        expect(o.restart).not.toHaveBeenCalled();
    });
});
