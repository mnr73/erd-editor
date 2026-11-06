/**
 * App icon registry (Iconify / hugeicons)
 * -----------------------------------------------------------------------------
 * Every icon is imported ONLY from this file so one concept always maps to one
 * icon:
 *
 *   import { IconClose } from "@/icons";
 *
 * Need a new icon? Check whether the concept exists here first. If not, add it
 * with a *concept* name (not the icon's name). Browse: https://icon-sets.iconify.design/hugeicons/
 *
 * Each icon is a tiny module and unused ones are tree-shaken (see vite.config.js).
 * (?) = temporary icon, needs review.
 */

/* ------------------------------ status / messages --------------------------- */

/** Info / hint */
export { default as IconInfo } from "~icons/hugeicons/information-circle";
/** Warning (triangle) */
export { default as IconWarning } from "~icons/hugeicons/alert-02";
/** Error (circle) */
export { default as IconError } from "~icons/hugeicons/alert-circle";
/** Success */
export { default as IconSuccess } from "~icons/hugeicons/checkmark-circle-02";
/** Close / cancel */
export { default as IconClose } from "~icons/hugeicons/cancel-01";
/** Help / legend */
export { default as IconHelp } from "~icons/hugeicons/help-circle";
