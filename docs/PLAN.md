# erd-editor — نقشه‌ی راه

## تصمیم‌های ثابت

| موضوع      | انتخاب                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------- |
| Shell      | Tauri **v2** (فقط لینوکس: deb + AppImage؛ ویندوز/مک بعداً)                               |
| Frontend   | Vue 3.5 + Vite + Tailwind 4 + Pinia (بدون auto-import، طبق قرارداد erp-front)            |
| فرمت فایل  | `*.erd.json` (تک‌فایل، منبع حقیقت). DBML/SQL/PNG/SVG فقط export                          |
| زبان UI    | انگلیسی (پیش‌فرض) + فارسی با RTL، `vue-i18n`                                             |
| بوم        | اختصاصی (SVG برای خطوط + لایه‌ی HTML برای جدول‌ها). Vue Flow فقط به‌عنوان ایده           |
| فونت‌ها    | Inter, JetBrains Mono, Vazirmatn (bundle محلی)                                           |
| ورود       | Open with / argv، یا صفحه‌ی شروع ساده (بورد جدید / باز کردن فایل). بدون recent files     |
| مرجع طراحی | `design/mockups/` (خروجی خام) و `design/extracted/*-inner.html` (HTML تمیزشده‌ی هر صفحه) |

چرا بوم اختصاصی: خطوط باید به **ردیف ستون** وصل شوند (نه به کل node)، با نماد Crow's Foot، هایلایت متقابل و Section مثل FigJam که اعضا را با خودش می‌برد. در Vue Flow همه‌ی این‌ها edge/handle سفارشی و دور زدن مدل node می‌خواهد. بوم اختصاصی حدود ۲۰۰۰ تا ۳۰۰۰ خط است و محدودیتی نمی‌آورد.

## مراحل (بعد از هر مرحله کامیت)

### ۱. اسکلت پروژه و وابستگی‌ها ✅

- `create-tauri-app` (Vue + JS) → Tauri 2، Vite، Tailwind 4، Pinia، vue-i18n، plugin-fs/dialog/cli.
- فونت‌های محلی، ESLint/Prettier طبق سبک erp-front.
- capabilities حداقلی، CSP، پنجره‌ی خالی.
- **file association** (`.erd.json`، mime مخصوص) در `tauri.conf.json` برای deb/AppImage و دریافت مسیر فایل از argv.
- خروجی: `npm run tauri dev` پنجره‌ی خالی باز کند.

### ۲. مدل داده و فرمت فایل (بدون UI) ✅

- spec فرمت در `docs/FORMAT.md` + `erd.schema.json`، فیلد `version`، id پایدار، حفظ کلیدهای ناشناخته.
- store (Pinia): tables, columns, refs, groups, notes, palette, view.
- validate/migrate هنگام باز کردن؛ undo/redo (command stack یا snapshot).
- تست واحد (vitest) برای validate و migration.

### ۳. design tokens و کامپوننت‌های پایه‌ی UI ✅

- تم تیره/روشن با CSS variables از style guide، RTL/LTR.
- کامپوننت‌های عمومی: Popover، ContextMenu، Tooltip، Toast، Switch، ColorSwatch، IconButton (slot محور).
- صفحه‌ی dev برای دیدن همه‌ی کامپوننت‌ها.

### ۴. بوم ✅

- pan/zoom، dot grid، minimap، انتخاب مستطیلی و چندتایی.
- ماشین حالت ورودی (pointer events) و کوردینیت‌های world↔screen.

### ۵. جدول و ستون ✅

- **ایندکس چندستونه**: انتخاب چند ستون ← Ctrl+I / راست‌کلیک / دکمه‌ی ⋯ ← ویرایشگر ایندکس (ترتیب ستون‌ها، unique، نوع btree/hash، نام اختیاری)؛ آیکون ایندکس روی ستون‌ها با tooltip.
- TableNode (هدر رنگی، collapse)، ColumnRow با آیکون ویژگی‌ها، popover ویرایش ستون، افزودن/مرتب‌سازی/حذف.
- drag جدول، رنگ هدر با پالت پیش‌فرض و رنگ‌های سفارشی.

### ۶. رابطه‌ها ✅

- محاسبه‌ی anchor هر ستون، مسیریابی منحنی/orthogonal، Crow's Foot، self-reference.
- ساخت رابطه با drag، ویرایش نوع، On Delete/Update، هایلایت متقابل، Legend.
- انجام‌شده: خط‌ها روی سطر ستون (Crow's Foot، مسیر منحنی/orthogonal، حلقه برای self-reference و جدول‌های زیر هم، جداسازی خطوط موازی)، ساخت با کشیدن از نقطه‌ی سطر یا ابزار R، انتخاب/hover/هایلایت، ویرایشگر رابطه (دوبار کلیک یا Enter)، جابه‌جایی دو سر، حذف، undo، راهنمای نشانه‌ها (`?`). منطق هندسه در `src/model/relations.js` (خالص، مشترک با export).

### ۷. گروه و Note ✅

- Section با رنگ، resize، عضویت خودکار با drop، حرکت اعضا، collapse.
- Note روی جدول و گروه (آیکون + popover + کارت دائمی).
- انجام‌شده: ابزار سکشن (S، کشیدن مستطیل یا کلیک)، گروه‌بندی جدول‌های انتخاب‌شده (Ctrl+G یا منو) با فریم متناسب، تغییر نام (دوبار کلیک/F2)، رنگ، حذف بدون حذف جدول‌ها، یادداشت جدول/سکشن (N یا آیکون) با ویرایشگر و کارت سنجاق‌شده که با درگ و resize دنبال صاحبش می‌آید. `noteVisible` برای group به فرمت اضافه شد.

### ۸. فایل، تب و پنجره (Rust) ✅

- باز کردن از argv/Open with و single-instance، ذخیره (Ctrl+S)، Save As، ذخیره‌ی اتمیک، نشانگر unsaved و تأیید بستن، تغییر فایل از بیرون.
- command های Rust برای خواندن/نوشتن (فقط پسوند `.erd.json`، نوشتن اتمیک با temp + rename).
- **تب‌ها** (چند فایل هم‌زمان، Ctrl+Tab / Ctrl+1..9 / Ctrl+W / Ctrl+N)، **صفحه‌ی شروع**، دیالوگ ذخیره/ذخیره نکن/لغو برای هر تب و هنگام بستن پنجره، Open with روی نمونه‌ی در حال اجرا یک تب جدید می‌سازد.

### ۹. Inspector، جستجو، میان‌برها

- پنل خصوصیات، Ctrl+K، context menu‌ها، میان‌برها، toast خطاها.

### ۱۰. Export

- DBML (تابع خالص JSON→DBML)، SQL (از طریق `@dbml/core`)، PNG/SVG.
- (اختیاری بعدی) import از DBML/SQL.

### ۱۱. i18n، صیقل و بسته‌بندی

- ترجمه‌ی فارسی کامل و تست RTL، کارایی با ۱۰۰+ جدول (virtualization/culling).
- build لینوکس، تست Open with روی deb و AppImage، آیکون، README.

## بعداً

ویندوز و مک، import از DBML/SQL و دیتابیس زنده، رابطه‌ی چندبه‌چند با جدول واسط، plugin/theme.
