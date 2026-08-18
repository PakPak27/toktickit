# Lab 2 UI Specification — Zen Green Theme

## 1. Color Tokens

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#006B3C` | App header background, primary buttons, strong emphasis |
| `--color-secondary` | `#0B7A46` | Active tab underline, focus ring accent, links, hover states |
| `--color-pale` | `#EAF6EF` | Selected row/card background, success banners, subtle section emphasis |
| `--color-bg` | `#F5F7F6` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, panels, table surface |
| `--color-border` | `#D7DEDA` | Subtle card/table borders |
| `--color-text` | `#1F2A24` | Body text (dark charcoal-green, not pure black) |
| `--color-editable-bg` | `#FFFFFF` | Editable field background |
| `--color-editable-border` | `#C7CFC9` | Editable field border |
| `--color-readonly-bg` | `#F1EFE6` | Read-only field background (warm ivory) |
| `--color-error` | `#B3261E` | Error text/border |
| `--color-warning` | `#B26A00` | Warning callout/badge text |
| `--color-warning-bg` | `#FFF3DC` | Warning callout background |
| `--color-success` | `#0B7A46` | Success confirmation text/icon |

## 2. Typography and Spacing
- Font family: system UI stack (`-apple-system, Segoe UI, Roboto, sans-serif`) for
  performance and native feel.
- Base size: 16px body, 14px helper/meta text, 20–24px section headings.
- Spacing scale: 4px base unit — 4/8/12/16/24/32px used consistently for padding/margins.
- Line height: 1.5 for body text, 1.3 for headings.

## 3. Field States

| State | Style |
|---|---|
| Editable | White bg, `--color-editable-border`, dark text |
| Read-only | `--color-readonly-bg`, no border emphasis, slightly muted text, not focusable |
| Invalid | Red border (`--color-error`), red message directly below the field |
| Disabled | Reduced opacity (0.5), `not-allowed` cursor, no hover/focus effects |
| Focused | 2px `--color-secondary` outline, visible for keyboard nav (never removed) |

## 4. Required-Field Marker and Validation Placement
- Required fields show a red asterisk (`*`) immediately after the label text.
- The asterisk alone is never sufficient — every required field also has a validation
  message that appears directly below that specific field when invalid (never only a
  single summary error at the top of the form).
- Validation messages use `--color-error` text, small icon prefix, 13px font size.

## 5. Button Hierarchy

| Style | Usage | Example |
|---|---|---|
| Primary | Main positive action | Submit, Continue, Create Ticket |
| Secondary | Alternate action | Cancel, Clear Filters |
| Tertiary | Low-emphasis action | Change Requester (text/link style) |
| Destructive | Irreversible-feeling action | Remove Attachment |
| Disabled | Action unavailable | Submit while form invalid |
| Busy | Action in flight | Submit while request pending (spinner + disabled) |

Primary: solid `--color-primary` bg, white text. Secondary: white bg, `--color-primary`
border+text. Tertiary: no border, `--color-secondary` text, underline on hover.
Destructive: white bg, `--color-error` border+text, confirms via dialog before firing.
Disabled: 0.5 opacity, no pointer events. Busy: spinner icon + disabled state + original
label dimmed.

## 6. Attachment Selection and Error Presentation
- File picker button shows accepted types (JPG/JPEG/PNG/WEBP/PDF) and 5MB limit as helper
  text beneath it.
- Each selected file shows as a chip/row with filename, size, and a remove (×) control
  before upload.
- Invalid file (wrong type / too large / limit exceeded) shows an inline red message next
  to that specific file attempt — never blocks the rest of the form.

## 7. Screen States
Every screen implements: **Initial**, **Loading**, **Validation** (Create Ticket only),
**Submitting/Busy**, **Success**, **Failure/Error**, and — for list screens — **Empty**
and **No Results**.

- **Initial:** default rendering before any user action.
- **Loading:** skeleton or centered spinner with "Loading…" text, no layout shift.
- **Validation:** inline field messages, form otherwise unchanged, focus moves to the
  first invalid field.
- **Submitting:** primary button shows busy state, all inputs disabled, no double-submit.
- **Success:** confirmation with the Ticket Number (Create Ticket) or updated list
  (My Tickets) — never a bare "OK" with no data shown.
- **Failure:** safe, human-readable message; never raw stack traces or fetch errors;
  form values preserved where applicable (BR-20).
- **Empty:** shown when a Requester genuinely has 0 tickets — different copy from...
- **No Results:** shown when filters/search matched 0 of N existing tickets, with a
  "Clear Filters" affordance.

## 8. Desktop / Tablet / Mobile Layout Rules

| Viewport | Range | Rule |
|---|---|---|
| Desktop | ≥ 992px | Multi-column layout, content max-width ~1140px centered |
| Tablet | 768–991px | Two-column where practical; Summary/Description get full width |
| Mobile | < 768px | Single column, fields stack vertically, touch targets ≥44px, no horizontal scroll |

All sizes: no clipped labels, no overlapping messages, no hidden buttons behind other
elements, attachment filenames truncate with ellipsis + full name on hover/tap rather than
overflowing.

## 9. Accessibility
- Every form control has an associated `<label>` (visible, not placeholder-only).
- Icon-only controls (e.g., remove-file ×) have `aria-label` + native tooltip.
- Focus order follows visual/reading order; focus ring never suppressed via CSS.
- Color is never the only indicator of state — badges/messages always include text, not
  just color (supports colorblind users and BR requirement for non-color indicators).
- All interactive elements reachable and operable via keyboard alone (Tab/Enter/Space).

## 10. Visual Inspection Checklist and Screenshot Paths
Checklist (completed during Issue #6, results recorded in `tests.md` Section 4):
- [ ] No clipping at any of the 3 viewports
- [ ] No overlapping messages
- [ ] No unintended horizontal scroll
- [ ] Consistent field styling across all 3 screens
- [ ] All required states implemented and styled correctly

Screenshot paths (captured via Playwright, `e2e/lab-02/visual.spec.ts`):


## 11. Application Shell and Active Navigation
- Header: TokTickIT logo/title (left, `--color-primary` bg, white text), nav links
  "My Tickets" and "Create Ticket" (center/left-adjacent), current Requester name +
  "Change Requester" (right).
- Active nav link: underlined with `--color-secondary`, slightly bolder weight.
- Mobile: nav collapses to a hamburger/menu button; Requester info moves into that menu.

## 12. Ticket-List Columns and Mobile Representation
**Desktop table columns:** Ticket No., Created Date, Summary, Category, Requested
Priority, Current Status, Last Updated.
**Mobile card:** Ticket No. + Current Status badge on top row; Summary as card title;
Category, Requested Priority, Created Date as smaller meta rows below; entire card is
tappable to open Ticket Detail.

## 13. Search, Filters, Sort, Clear-Filters, Pagination Controls
- Search: single text input, placeholder "Search by ticket number or summary…", debounced
  (~300ms) before firing the API call.
- Filters: 3 dropdowns (Category, Requested Priority, Status) — IT Priority filter is
  present but will mostly show "unset" values in Lab 2 since IT Priority isn't set yet.
- Sort: clickable column headers on desktop (with ↑/↓ indicator); a dedicated sort
  dropdown on mobile (no clickable table headers there).
- Clear Filters: secondary button, visible whenever any filter/search is active, resets
  to defaults in one click.
- Pagination: Previous/Next + numbered pages (desktop), simplified Previous/Next +
  "Page X of Y" (mobile), page-size selector (10/20/50) on desktop only.

## 14. Priority and Status Badge Rules
| Value | Badge color | Text |
|---|---|---|
| Requested Priority: LOW | `--color-pale` bg, dark text | "Low" |
| Requested Priority: MEDIUM | `--color-warning-bg` bg, `--color-warning` text | "Medium" |
| Requested Priority: HIGH | light red bg, `--color-error` text | "High" |
| Current Status: NEW | `--color-pale` bg, `--color-secondary` text | "New" |
| IT Priority: unset | gray bg, gray text | "—" |

Badges always render as filled pill with visible text label — never color-only.

## 15. Empty-List vs. No-Results Presentation
- **Empty (0 tickets ever):** centered illustration/icon + "You haven't created any
  tickets yet." + primary "Create Ticket" button.
- **No Results (filters matched 0 of N):** centered text "No tickets match your filters."
  + secondary "Clear Filters" button. No illustration (keeps it visually distinct from
  Empty at a glance).

## 16. Requester Ticket Detail Read-Only Layout
- Top section: Ticket No., Ticket Date, Category, Related System (2–4 column grid,
  read-only field styling).
- Middle section: Requester (read-only), Requested Priority badge, IT Priority badge
  ("—" if unset), Current Status badge.
- Summary + Description: full-width read-only text blocks.
- Attachments: separate card/section below, clearly visually distinct from the ticket
  header (per Section 8.5 requirement).

## 17. Active / Uploading / Invalid / Removed / Unavailable Attachment States
| State | Visual |
|---|---|
| Active | Filename, size, uploaded date, Download + Remove controls enabled |
| Uploading | Progress indicator, filename, cancel control |
| Invalid (rejected pre-upload) | Red inline message, file never appears in the persisted list |
| Removed | Filename with strikethrough or "Removed" badge, removal reason + date shown, Download disabled/hidden |
| Unavailable (download 403/410 somehow reached) | Toast/error message, no broken download attempt |

## 18. Desktop Table and Mobile Card / Responsive-Table Behavior
Desktop uses a real `<table>` for My Tickets for sortable headers and screen-reader
semantics. Below 768px, the table is replaced (not just scrolled) with a stacked card
list — avoids horizontal scrolling or tiny unreadable table text on phones.

## 19. Screenshot Paths for Create Ticket, My Tickets, and Ticket Detail
(Restated from Section 10 for completeness)