// Usage: node scripts/bump.mjs <major|minor|patch|X.Y.Z>
// Sets one version in package.json, tauri.conf.json, Cargo.toml and both lockfiles.
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const read = (f) => readFileSync(f, "utf8");
const pkg = JSON.parse(read("package.json"));
const arg = process.argv[2];
let [maj, min, pat] = pkg.version.split(".").map(Number);
let next = arg;
if (arg === "major") next = `${maj + 1}.0.0`;
else if (arg === "minor") next = `${maj}.${min + 1}.0`;
else if (arg === "patch") next = `${maj}.${min}.${pat + 1}`;
if (!/^\d+\.\d+\.\d+$/.test(next ?? "")) {
    console.error("usage: node scripts/bump.mjs <major|minor|patch|X.Y.Z>");
    process.exit(1);
}

const sub = (f, re, to) => {
    const s = read(f);
    if (!re.test(s)) throw new Error(`version not found in ${f}`);
    writeFileSync(f, s.replace(re, to));
};
sub("package.json", /("version": ")[^"]+/, `$1${next}`);
const lock = JSON.parse(read("package-lock.json"));
lock.version = lock.packages[""].version = next;
writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\n");
sub("src-tauri/tauri.conf.json", /("version": ")[^"]+/, `$1${next}`);
sub("src-tauri/Cargo.toml", /^(version = ")[^"]+/m, `$1${next}`);
sub(
    "src-tauri/Cargo.lock",
    /(name = "erd-editor"\nversion = ")[^"]+/,
    `$1${next}`,
);
console.log(
    `${pkg.version} -> ${next}\nnext: git commit -am "release v${next}" && git tag v${next} && git push origin main v${next}`,
);
