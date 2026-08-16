# UI Spacing Rubric (Calm Ops)

Pass/fail checklist for list pages, tables, and overlays. Brand Blue `#2563EB` only — no purple/glass redesign.

## Tokens (`globals.css`)

| Token | Target | Pass |
|-------|--------|------|
| `--space-page-x` | ≥ 16px (sm+ 24px via shell) | ☐ |
| `--space-page-y` | ≥ 20px | ☐ |
| `--space-section` / `--space-stack` | 20–24px bands | ☐ |
| `--space-field` | ≥ 16px form field gap | ☐ |
| `--space-tap` | ≥ 40px tap height | ☐ |

## Surfaces

| Surface | Pass if | Fail if |
|---------|---------|---------|
| **List pages** | `px-4 py-5 sm:px-6`; vertical stack ≥ `space-y-5` | `space-y-3` or tighter; jammed sections |
| **Header → KPIs → toolbar → table** | Clear 20–24px bands | Toolbar jammed into MetricStrip |
| **DataTable rows** | Comfortable cell pad (`py-2.5`+); actions clear of text | `py-1.5` cramped; colliding actions |
| **Filter chips / buttons** | Gap ≥ `gap-2` (group ≥ `gap-1`); min tap ~40px (`min-h-10`) | `min-h-8` only; `gap-0.5` only |
| **RecordDrawer / ModalShell** | Header/body/footer padding consistent (`px-6`); body fields `space-y-4` min | Uneven padding; body without field gap |
| **Mobile (390)** | No horizontal overflow; safe page padding | Clipped content; edge-to-edge controls |

## Quick audit commands

1. Open Inventory / Deals / Leads / Customers at 1280 and 390.
2. Confirm ListPageShell stack reads as separate bands (not glued).
3. Open a RecordDrawer + an Add form modal; check header/body/footer rhythm.
4. Tab through filter chips — hit area feels ≥ 40px.
