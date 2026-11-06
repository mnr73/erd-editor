/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
export default {
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    plugins: ["@trivago/prettier-plugin-sort-imports"],
    importOrder: [
        "^vue$", // اول خود Vue
        "^vue-router$", // بعد vue-router
        "<THIRD_PARTY_MODULES>", // بعد کتابخونه‌های خارجی
        "^~icons/(.*)$", // آیکون‌ها (unplugin-icons)
        "^@/components/(.*)$", // کامپوننت‌های پروژه
        "^@/(.*)$", // بقیه aliasها
        "^[./]", // در آخر ایمپورت‌های نسبی
    ],
    importOrderSeparation: true,
    importOrderSortSpecifiers: true,
};
