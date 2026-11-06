import { describe, expect, it } from "vitest";

import { nextName, uniqueName } from "@/model/names";
import { typeSuggestions } from "@/model/types";
import { nextIndex } from "@/utils/listNav";

describe("names", () => {
    it("uniqueName keeps a free name and suffixes a taken one (case-insensitive)", () => {
        expect(uniqueName(["a"], "b")).toBe("b");
        expect(uniqueName(["users", "users_2"], "Users")).toBe("Users_3");
    });
    it("nextName counts from 1", () => {
        expect(nextName([], "table")).toBe("table_1");
        expect(nextName(["table_1", "TABLE_2"], "table")).toBe("table_3");
    });
});

describe("typeSuggestions", () => {
    it("prefix matches come first, exact match is omitted", () => {
        const r = typeSuggestions("var");
        expect(r[0]).toBe("varchar(255)");
        expect(typeSuggestions("bigint")).not.toContain("bigint");
    });
    it("is dialect aware and limited", () => {
        expect(typeSuggestions("json", "postgres")).toContain("jsonb");
        expect(typeSuggestions("json", "mysql")).not.toContain("jsonb");
        expect(typeSuggestions("", "generic", 3)).toHaveLength(3);
    });
});

describe("nextIndex", () => {
    it("cycles through items and the typed-text slot (-1)", () => {
        expect(nextIndex(-1, 3, 1)).toBe(0);
        expect(nextIndex(1, 3, 1)).toBe(2);
        expect(nextIndex(2, 3, 1)).toBe(-1);
        expect(nextIndex(-1, 3, -1)).toBe(2);
        expect(nextIndex(0, 3, -1)).toBe(-1);
    });
    it("empty list stays on -1", () => {
        expect(nextIndex(-1, 0, 1)).toBe(-1);
        expect(nextIndex(-1, 0, -1)).toBe(-1);
    });
});
