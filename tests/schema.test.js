import Ajv from "ajv";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createDocument } from "@/model/document";
import { serializeErd } from "@/model/serialize";
import { parseErd } from "@/model/validate";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const validate = new Ajv({ allErrors: true }).compile(
    JSON.parse(read("../schema/erd.schema.json")),
);

describe("erd.schema.json", () => {
    it("accepts the fixture and the serializer's output", () => {
        expect(validate(JSON.parse(read("./fixtures/shop.erd.json")))).toBe(
            true,
        );
        const out = JSON.parse(
            serializeErd(parseErd(read("./fixtures/shop.erd.json")).doc),
        );
        expect(validate(out), JSON.stringify(validate.errors)).toBe(true);
        expect(
            validate(JSON.parse(serializeErd(createDocument("empty")))),
        ).toBe(true);
    });

    it("rejects broken documents", () => {
        expect(
            validate({
                format: "erd-editor",
                version: 1,
                tables: [{ id: "t" }],
            }),
        ).toBe(false);
        expect(validate({ format: "nope", version: 1 })).toBe(false);
    });
});
