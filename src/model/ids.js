/** Short random id with a kind prefix, e.g. `t_k3j9x2ab`. Stable for the lifetime of the entity. */
export function newId(prefix) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return `${prefix}_${Array.from(bytes, (b) => (b % 36).toString(36)).join("")}`;
}

export const ID_PREFIX = {
    table: "t",
    column: "c",
    index: "i",
    ref: "r",
    group: "g",
    enum: "e",
    note: "n",
};
