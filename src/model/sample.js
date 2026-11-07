import {
    createColumn,
    createDocument,
    createGroup,
    createIndex,
    createNote,
    createRef,
    createRefEnd,
    createTable,
} from "./document";
import {
    pinnedNotes,
    sectionAround,
    tableHeight,
    tableRect,
    tableWidth,
} from "./geometry";

/**
 * The "sample board": a small blog schema that shows what the editor can do (sections, colors, every
 * kind of key, a composite index, an enum, notes of all kinds, relationships of different shapes
 * including a self reference). Built from the same factories as user data, so every id is fresh and
 * the result is an ordinary document. Positions are computed from the real table sizes.
 *
 * `text` supplies the human words (board name, notes) so they follow the UI language; table and
 * column names stay English because they are identifiers.
 */

const DEFAULT_TEXT = {
    name: "Sample blog",
    boardNote:
        "A small blog database to explore the editor. Edit or delete anything.",
    categoriesNote:
        "Categories can nest: parent_id points at another category.",
    slugNote: "Used in the URL; must be unique.",
    sectionAccounts: "Accounts",
    sectionContent: "Content",
    sticky: "Start here: double-click empty canvas for a table, drag from a column's dot to draw a relationship, press ? for help.",
};

const GAP_X = 70;
const GAP_Y = 50;

const col = (name, type, extra = {}) => createColumn({ name, type, ...extra });
const pk = (name = "id") =>
    col(name, "bigint", { pk: true, increment: true, notNull: true });
const fk = (name, extra = {}) =>
    col(name, "bigint", { notNull: true, ...extra });

/** Places `tables` in a row starting at (x, y); returns the next free x. */
function row(tables, x, y) {
    let cx = x;
    for (const t of tables) {
        t.x = cx;
        t.y = y;
        cx += tableWidth(t) + GAP_X;
    }
    return cx - GAP_X;
}

export function buildSampleDocument(text = {}) {
    const s = { ...DEFAULT_TEXT, ...text };
    const doc = createDocument(s.name);
    doc.meta.dbType = "mysql";
    doc.meta.note = s.boardNote;

    const users = createTable({
        name: "users",
        color: "#4C8DFF",
        columns: [
            pk(),
            col("email", "varchar(255)", { notNull: true, unique: true }),
            col("name", "varchar(120)", { notNull: true }),
            col("role", "enum('reader','author','admin')", {
                notNull: true,
                default: "'reader'",
            }),
            col("created_at", "timestamp", {
                notNull: true,
                default: "CURRENT_TIMESTAMP",
            }),
        ],
    });
    const profiles = createTable({
        name: "profiles",
        color: "#4C8DFF",
        columns: [
            col("user_id", "bigint", { pk: true, notNull: true }),
            col("bio", "text"),
            col("avatar_url", "varchar(500)"),
        ],
    });
    const categories = createTable({
        name: "categories",
        color: "#E0A33A",
        note: s.categoriesNote,
        noteVisible: true,
        columns: [
            pk(),
            col("parent_id", "bigint"),
            col("name", "varchar(120)", { notNull: true }),
        ],
    });
    const posts = createTable({
        name: "posts",
        color: "#8B7CF6",
        columns: [
            pk(),
            fk("author_id"),
            col("category_id", "bigint"),
            col("title", "varchar(200)", { notNull: true }),
            col("slug", "varchar(200)", {
                notNull: true,
                unique: true,
                note: s.slugNote,
            }),
            col("body", "text"),
            col("status", "enum('draft','published','archived')", {
                notNull: true,
                default: "'draft'",
            }),
            col("published_at", "datetime"),
        ],
    });
    const comments = createTable({
        name: "comments",
        color: "#4CB86B",
        columns: [
            pk(),
            fk("post_id"),
            fk("user_id"),
            col("body", "text", { notNull: true }),
            col("created_at", "timestamp", {
                notNull: true,
                default: "CURRENT_TIMESTAMP",
            }),
        ],
    });

    // composite index: the common "latest published posts" query
    const status = posts.columns.find((c) => c.name === "status");
    const published = posts.columns.find((c) => c.name === "published_at");
    posts.indexes.push(
        createIndex({ columns: [status.id, published.id], unique: false }),
    );

    // layout: Accounts on the left, Content to its right. `comments` sits straight under `posts`; the pinned
    // note belongs to `categories`, so it never covers the posts → comments line.
    row([users], 60, 70);
    profiles.x = users.x;
    profiles.y = users.y + tableHeight(users) + GAP_Y;
    const accountsRight = Math.max(
        users.x + tableWidth(users),
        profiles.x + tableWidth(profiles),
    );
    row([posts, categories], accountsRight + 160, 70);
    const pinned = pinnedNotes({ tables: [categories], groups: [] })[0];
    comments.x = posts.x;
    comments.y = posts.y + tableHeight(posts) + GAP_Y;

    doc.tables.push(users, profiles, categories, posts, comments);

    const ref = (from, fromCol, to, toCol, fromCard, toCard, extra = {}) => {
        const c = (t, n) => t.columns.find((x) => x.name === n).id;
        return createRef({
            from: createRefEnd({
                table: from.id,
                columns: [c(from, fromCol)],
                cardinality: fromCard,
            }),
            to: createRefEnd({
                table: to.id,
                columns: [c(to, toCol)],
                cardinality: toCard,
            }),
            ...extra,
        });
    };
    doc.refs.push(
        ref(profiles, "user_id", users, "id", "0..1", "1", {
            onDelete: "cascade",
        }),
        ref(posts, "author_id", users, "id", "0..*", "1", { label: "writes" }),
        ref(posts, "category_id", categories, "id", "0..*", "0..1", {
            onDelete: "set null",
        }),
        ref(categories, "parent_id", categories, "id", "0..*", "0..1"),
        ref(comments, "post_id", posts, "id", "0..*", "1", {
            onDelete: "cascade",
        }),
        ref(comments, "user_id", users, "id", "0..*", "1"),
    );

    const rects = (ts) => ts.map(tableRect);
    doc.groups.push(
        createGroup({
            name: s.sectionAccounts,
            color: "#4C8DFF",
            ...sectionAround(rects([users, profiles])),
        }),
        createGroup({
            name: s.sectionContent,
            color: "#8B7CF6",
            ...sectionAround([
                ...rects([categories, posts, comments]),
                { x: pinned.x, y: pinned.y, w: pinned.w, h: pinned.h },
            ]),
        }),
    );

    const first = doc.groups[0];
    doc.notes.push(
        createNote({
            text: s.sticky,
            color: "#E0A33A",
            x: first.x,
            y: first.y + first.h + 40,
            w: 300,
            h: 100,
        }),
    );
    return doc;
}
