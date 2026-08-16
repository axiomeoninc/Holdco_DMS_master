# Gold UX pattern ports (inspiration only)

Hand-port these Magic UI / Aceternity / 21st.dev / React Bits patterns into **existing gold tokens** (`#00AEEF`, hairline borders, quiet radii). **Do not** add kit npm packages.

| # | Pattern (inspiration) | Gold-native port | Status |
|---|----------------------|------------------|--------|
| 1 | Subtle card lift on hover | Hub cards: `hover:-translate-y-0.5` + border tint to primary | Applied on `/platform` hub |
| 2 | Soft spotlight / icon wash | Icon well `bg-[#00AEEF]/10` → `/15` on group-hover | Applied on `/platform` hub |
| 3 | Marquee / infinite logo strip | Skip for admin chrome; use static MetricStrip if needed | Documented only |
| 4 | Border beam / animated gradient stroke | Prefer static `border-[#00AEEF]/50` on focus/hover — no continuous animation in CRM lists | Documented only |
| 5 | Bento grid with staggered fade-in | Optional later: CSS `@starting-style` / short opacity on hub sections only | Documented only |

## Rules

- Motion ≤ ~200ms; respect `prefers-reduced-motion` when adding keyframes later.
- No purple glow, no glass orbs, no new UI kits.
- Prefer Tailwind already in repo; keep StatCard free of decorative hover orbs (dashboard tiles stay flat).
