# Gold components signoff

**Date:** 2026-08-04  
**Scope:** `gold-components` only (no CF deploy, no MiniMax / `api/ai/*`)

## Done

1. **Packages** — TipTap (`@tiptap/react` + starter-kit), cmdk, react-day-picker, date-fns, `@tanstack/react-virtual`, react-hook-form, `@hookform/resolvers`, zod, Vaul. Kept `@dnd-kit/*`. Recharts + Sonner already present.
2. **Thin wrappers** under `src/components/ui/`:
   - `rich-text-editor.tsx` (TipTap)
   - `chart.tsx` (Recharts palette / container)
   - `toaster.tsx` (Sonner)
   - `command.tsx` (cmdk)
   - `date-picker.tsx` (day-picker + date-fns)
   - `virtual-list.tsx` (react-virtual)
   - `form.tsx` (RHF helpers + zodResolver)
   - `drawer.tsx` (Vaul)
3. **Wiring**
   - Vehicle description + internal notes → TipTap (intake wizard); VDP display via `RichTextDisplay`
   - Dashboard / reports → electric-blue `CHART_COLORS` from `ui/chart`
   - App shell → `ui/toaster`
   - ⌘K palette → cmdk
   - FU / TD / reports date filters → `DatePicker`
   - Inventory grid → `VirtualList`; mobile filters → Vaul `Drawer`
   - Customer form → RHF + zod (`src/lib/schemas/customer.ts`); intake identity validation → zod (`vehicle-intake.ts`)
4. **tsc** — `npx tsc --noEmit` clean after changes.
5. **Skipped (per plan / sibling)** — CF deploy, MiniMax AI, `api/ai/*`.

## Stack

Next.js + Supabase + Cloudflare OpenNext — unchanged.
