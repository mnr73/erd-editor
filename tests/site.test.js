import Ajv from "ajv";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { toSql } from "@/model/export/sql";
import { serializeErd } from "@/model/serialize";
import { parseErd } from "@/model/validate";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("site/example.erd.json (shown on the website)", () => {
    const text = read("../site/example.erd.json");

    it("is valid for the app and for the JSON Schema, with no warnings", () => {
        const { doc, issues } = parseErd(text);
        expect(issues).toEqual([]);
        expect(doc.tables.map((t) => t.name)).toEqual(["users", "orders"]);
        const validate = new Ajv({ allErrors: true }).compile(
            JSON.parse(read("../schema/erd.schema.json")),
        );
        expect(
            validate(JSON.parse(text)),
            JSON.stringify(validate.errors),
        ).toBe(true);
    });

    it("is already in the canonical serialized form (clean diffs)", () => {
        const { doc } = parseErd(text);
        expect(JSON.parse(serializeErd(doc))).toEqual(JSON.parse(text));
    });

    it("exports SQL with the foreign key", () => {
        const { doc } = parseErd(text);
        const sql = JSON.stringify(toSql(doc));
        expect(sql).toMatch(/FOREIGN KEY|REFERENCES/i);
        expect(sql).toMatch(/ON DELETE CASCADE/i);
    });
});
