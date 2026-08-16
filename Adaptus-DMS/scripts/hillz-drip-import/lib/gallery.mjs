/**
 * Mirrors Adaptus serializeGallery() — DB text[] of JSON-encoded objects.
 */
export function serializeGallery(images) {
  return images.map((img, i) =>
    JSON.stringify({
      url: img.url,
      role: img.role ?? null,
      is_cover: img.is_cover ?? i === 0,
      sort_order: typeof img.sort_order === "number" ? img.sort_order : i,
    })
  );
}

export function parseGallery(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (typeof entry === "string") {
      try {
        const parsed = JSON.parse(entry);
        if (parsed && typeof parsed.url === "string") {
          out.push({
            url: parsed.url,
            role: parsed.role ?? null,
            is_cover: parsed.is_cover ?? i === 0,
            sort_order: typeof parsed.sort_order === "number" ? parsed.sort_order : i,
          });
          continue;
        }
      } catch {
        /* legacy URL */
      }
      out.push({ url: entry, role: null, is_cover: i === 0, sort_order: i });
    } else if (entry && typeof entry.url === "string") {
      out.push({
        url: entry.url,
        role: entry.role ?? null,
        is_cover: entry.is_cover ?? i === 0,
        sort_order: typeof entry.sort_order === "number" ? entry.sort_order : i,
      });
    }
  }
  return out;
}

export function galleryHttpUrls(raw) {
  return parseGallery(raw).map((img) => img.url).filter((u) => typeof u === "string" && u.startsWith("http"));
}
