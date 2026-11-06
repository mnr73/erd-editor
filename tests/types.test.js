import { describe, expect, it } from "vitest";

import {
    availableFor,
    changeBase,
    formatType,
    parseEnumValues,
    parseType,
    setParam,
    supportsArray,
    supportsUnsigned,
    typeDef,
    typeGroups,
} from "@/model/types";

describe("parseType / formatType", () => {
    it("round-trips every catalog shape", () => {
        for (const t of [
            "decimal(12,2)",
            "numeric(10,0)",
            "varchar(255)",
            "char(36)",
            "bigint unsigned",
            "int",
            "text[]",
            "datetime(3)",
            "nvarchar(max)",
            "enum('a','b')",
            "timestamp",
        ]) {
            const p = parseType(t);
            expect(p, t).not.toBeNull();
            expect(formatType(p), t).toBe(t);
        }
    });

    it("is case-insensitive on the type name and tolerant of spaces", () => {
        expect(parseType("DECIMAL( 10 , 2 )")).toMatchObject({
            base: "decimal",
            params: [10, 2],
        });
        expect(parseType("  VarChar(40) ")).toMatchObject({
            base: "varchar",
            params: [40],
        });
    });

    it("a bare parameterised type stays bare (no invented numbers)", () => {
        const p = parseType("varchar");
        expect(p.params).toEqual([null]);
        expect(formatType(p)).toBe("varchar");
        expect(formatType(parseType("decimal"))).toBe("decimal");
    });

    it("a single precision is kept as written", () => {
        expect(formatType(parseType("decimal(10)"))).toBe("decimal(10)");
        expect(parseType("decimal(10)").params).toEqual([10, null]);
    });

    it("anything outside the catalog is null so the UI falls back to free text", () => {
        for (const t of [
            "",
            "garbage type",
            "varchar(0)",
            "varchar(99999)",
            "decimal(1,2,3)",
            "int()",
            "varchar(x)",
            "geometry(Point,4326)",
            "enum(a,b)",
        ]) {
            expect(parseType(t), t).toBeNull();
        }
    });

    it("enum values with quotes survive", () => {
        const p = parseType("enum('it\\'s','b')");
        expect(p.params).toEqual(["it's", "b"]);
        expect(parseType(formatType(p)).params).toEqual(["it's", "b"]);
    });
});

describe("editing a parsed type", () => {
    const dec = parseType("decimal(12,2)");

    it("changeBase resets parameters to the new type's defaults", () => {
        expect(formatType(changeBase(dec, "varchar"))).toBe("varchar(255)");
        expect(formatType(changeBase(parseType("varchar(40)"), "char"))).toBe(
            "char(40)",
        );
        expect(formatType(changeBase(dec, "int"))).toBe("int");
        expect(formatType(changeBase(dec, "numeric"))).toBe("numeric(12,2)");
        expect(formatType(changeBase(parseType("int"), "decimal"))).toBe(
            "decimal(12,2)",
        );
    });

    it("changeBase drops modifiers the new type or database can't have", () => {
        const u = parseType("bigint unsigned");
        expect(formatType(changeBase(u, "int", "mysql"))).toBe("int unsigned");
        expect(formatType(changeBase(u, "int", "postgres"))).toBe("int");
        expect(formatType(changeBase(u, "decimal", "mysql"))).toBe(
            "decimal(12,2)",
        );
    });

    it("setParam clamps to the range and keeps scale <= precision", () => {
        expect(formatType(setParam(dec, 0, 10))).toBe("decimal(10,2)");
        expect(formatType(setParam(dec, 0, 1))).toBe("decimal(1,1)");
        expect(formatType(setParam(dec, 1, 99))).toBe("decimal(12,12)");
        expect(formatType(setParam(dec, 0, 9999))).toBe("decimal(65,2)");
        expect(formatType(setParam(dec, 1, -3))).toBe("decimal(12,0)");
    });

    it("setParam: empty clears an optional parameter, resets a required one", () => {
        expect(formatType(setParam(parseType("datetime(3)"), 0, ""))).toBe(
            "datetime",
        );
        expect(formatType(setParam(parseType("varchar(40)"), 0, ""))).toBe(
            "varchar(255)",
        );
        expect(formatType(setParam(parseType("varchar(40)"), 0, "abc"))).toBe(
            "varchar(40)",
        );
        expect(formatType(setParam(parseType("nvarchar(50)"), 0, "MAX"))).toBe(
            "nvarchar(max)",
        );
    });

    it("setParam on a type without parameters is a no-op", () => {
        expect(setParam(parseType("int"), 0, 5)).toEqual(parseType("int"));
    });

    it("enum values", () => {
        expect(parseEnumValues(" a, b ,, c ")).toEqual(["a", "b", "c"]);
        expect(
            formatType({
                base: "enum",
                params: ["x", "y"],
                unsigned: false,
                array: false,
            }),
        ).toBe("enum('x','y')");
    });
});

describe("catalog by database", () => {
    it("engine-specific types are offered only where they exist", () => {
        expect(availableFor(typeDef("jsonb"), "postgres")).toBe(true);
        expect(availableFor(typeDef("jsonb"), "mysql")).toBe(false);
        expect(availableFor(typeDef("uniqueidentifier"), "mssql")).toBe(true);
        expect(availableFor(typeDef("varchar"), "sqlite")).toBe(true);
        expect(availableFor(typeDef("uuid"), "generic")).toBe(true);
    });

    it("the current type stays selectable even when the database doesn't offer it", () => {
        const names = (db, keep) =>
            typeGroups(db, keep).flatMap((g) => g.types.map((t) => t.id));
        expect(names("mysql")).not.toContain("jsonb");
        expect(names("mysql", "jsonb")).toContain("jsonb");
    });

    it("unsigned and array support", () => {
        expect(supportsUnsigned(typeDef("int"), "mysql")).toBe(true);
        expect(supportsUnsigned(typeDef("int"), "postgres")).toBe(false);
        expect(supportsUnsigned(typeDef("varchar"), "mysql")).toBe(false);
        expect(supportsArray("postgres")).toBe(true);
        expect(supportsArray("mysql")).toBe(false);
    });
});
