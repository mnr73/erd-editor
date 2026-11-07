// Fails when the updater signing key in the environment is not the key whose PUBLIC half is in
// src-tauri/tauri.conf.json. Without this, a release builds for ~10 minutes and then every installed
// app rejects the update ("the signature ... "), because it was signed with a different key.
//
// Needs TAURI_SIGNING_PRIVATE_KEY (and TAURI_SIGNING_PRIVATE_KEY_PASSWORD if the key has one).
// Run: node scripts/check-signing-key.mjs
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const fail = (msg) => {
    console.error(`::error::${msg}`);
    process.exit(1);
};

/** The 8-byte key id inside a minisign key or signature (base64 of a two-line text file). */
function keyId(b64, what) {
    try {
        const lines = Buffer.from(b64.trim(), "base64")
            .toString("utf8")
            .split("\n");
        const raw = Buffer.from(lines[1].trim(), "base64");
        return raw.subarray(2, 10).toString("hex");
    } catch {
        return fail(`${what} is not a valid minisign key or signature`);
    }
}

const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const pub = conf.plugins?.updater?.pubkey;
if (!pub) fail("src-tauri/tauri.conf.json has no plugins.updater.pubkey");
const appKeyId = keyId(pub, "plugins.updater.pubkey");

const secret = process.env.TAURI_SIGNING_PRIVATE_KEY;
if (!secret)
    fail(
        "Secret TAURI_SIGNING_PRIVATE_KEY is missing (Settings > Secrets and variables > Actions). Without it a release cannot update installed apps.",
    );
if (
    secret.trim().startsWith("untrusted comment") === false &&
    secret.length < 100
)
    fail(
        "TAURI_SIGNING_PRIVATE_KEY does not look like a private key (too short). Paste the whole content of the .key file, not the .pub file.",
    );

const dir = mkdtempSync(join(tmpdir(), "erd-sign-"));
const probe = join(dir, "probe.txt");
writeFileSync(probe, "probe");
const r = spawnSync(
    process.execPath,
    ["node_modules/@tauri-apps/cli/tauri.js", "signer", "sign", probe],
    {
        encoding: "utf8",
        env: {
            ...process.env,
            TAURI_SIGNING_PRIVATE_KEY: secret.trim(),
            TAURI_SIGNING_PRIVATE_KEY_PASSWORD:
                process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "",
        },
    },
);
let sig;
try {
    sig = readFileSync(`${probe}.sig`, "utf8");
} catch {
    fail(
        `The key could not sign anything (wrong password, or not a Tauri private key): ${(r.stderr || r.stdout || "").trim().split("\n").slice(-3).join(" ")}`,
    );
}
const usedId = keyId(sig, "probe signature");
if (usedId !== appKeyId)
    fail(
        `Signing key mismatch: the secret signs with key ${usedId}, but the app (tauri.conf.json) trusts key ${appKeyId}. Installed apps would reject every update. Put the private key that belongs to plugins.updater.pubkey into TAURI_SIGNING_PRIVATE_KEY.`,
    );
console.log(
    `Signing key matches the public key in tauri.conf.json (${appKeyId}).`,
);
