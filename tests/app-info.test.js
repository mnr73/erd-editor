import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { APP_LICENSE, APP_VERSION, GITHUB_URL, SITE_URL } from "@/app-info";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("app info", () => {
    it("the version shown in Help is the version that is released", () => {
        const pkg = JSON.parse(read("../package.json")).version;
        const tauri = JSON.parse(read("../src-tauri/tauri.conf.json")).version;
        const cargo = read("../src-tauri/Cargo.toml").match(
            /^version = "(.+)"/m,
        )[1];
        expect(APP_VERSION).toBe(pkg);
        expect(tauri).toBe(pkg);
        expect(cargo).toBe(pkg);
    });

    it("the licence in Help matches the LICENSE file and package metadata", () => {
        expect(read("../LICENSE")).toMatch(/^MIT License/);
        expect(JSON.parse(read("../package.json")).license).toBe(APP_LICENSE);
        expect(read("../src-tauri/Cargo.toml")).toMatch(
            new RegExp(`^license = "${APP_LICENSE}"`, "m"),
        );
    });

    it("project links point at the real repository and site", () => {
        expect(GITHUB_URL).toBe("https://github.com/mnr73/erd-editor");
        expect(SITE_URL.startsWith("https://mnr73.github.io/erd-editor")).toBe(
            true,
        );
    });
});
