import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url).pathname;

describe("release signing key check", () => {
    const run = (env) =>
        spawnSync("node", [root + "scripts/check-signing-key.mjs"], {
            cwd: root,
            encoding: "utf8",
            env: { PATH: process.env.PATH, ...env },
        });

    it("fails with a clear message when the secret is missing", () => {
        const r = run({});
        expect(r.status).toBe(1);
        expect(r.stdout + r.stderr).toMatch(
            /TAURI_SIGNING_PRIVATE_KEY is missing/,
        );
    });

    it("rejects something that is not a private key (e.g. the .pub text pasted by mistake)", () => {
        const pub = JSON.parse(
            readFileSync(root + "src-tauri/tauri.conf.json", "utf8"),
        ).plugins.updater.pubkey;
        const r = run({ TAURI_SIGNING_PRIVATE_KEY: pub });
        expect(r.status).toBe(1);
        expect(r.stdout + r.stderr).toMatch(
            /could not sign|too short|not a valid/,
        );
    });

    it("the public key in the app config is a well-formed minisign key", () => {
        const pub = JSON.parse(
            readFileSync(root + "src-tauri/tauri.conf.json", "utf8"),
        ).plugins.updater.pubkey;
        const lines = Buffer.from(pub, "base64").toString("utf8").split("\n");
        expect(lines[0]).toMatch(
            /^untrusted comment: minisign public key: [0-9A-F]{16}$/,
        );
        const raw = Buffer.from(lines[1], "base64");
        expect(raw.subarray(0, 2).toString()).toBe("Ed");
        // the id in the comment is the id inside the key (byte order reversed)
        expect(
            raw.subarray(2, 10).reverse().toString("hex").toUpperCase(),
        ).toBe(lines[0].split(": ").at(-1));
    });

    it("the release workflow runs the check before anything is built", () => {
        const wf = readFileSync(root + ".github/workflows/release.yml", "utf8");
        const verify = wf.slice(wf.indexOf("verify:"), wf.indexOf("build:"));
        expect(verify).toContain("node scripts/check-signing-key.mjs");
        expect(wf).toContain("needs: verify");
    });
});
