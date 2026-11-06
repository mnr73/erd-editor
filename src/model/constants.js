export const FORMAT = "erd-editor";
/** Current file format version. Bump together with a migration in migrate.js. */
export const VERSION = 1;
export const FILE_EXTENSION = ".erd.json";

export const CARDINALITIES = ["1", "0..1", "1..*", "0..*"];
export const REF_ACTIONS = [
    "cascade",
    "restrict",
    "set null",
    "set default",
    "no action",
];
export const DB_TYPES = ["generic", "mysql", "postgres", "sqlite", "mssql"];

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Child (FK holder) side / parent side defaults for a new relationship. */
export const DEFAULT_FROM_CARDINALITY = "0..*";
export const DEFAULT_TO_CARDINALITY = "1";

export const MIN_GROUP_SIZE = 120;
