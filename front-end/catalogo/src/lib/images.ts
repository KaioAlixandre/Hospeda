/** Cloudinary URL transform; passthrough for other hosts. */
export function cloudinaryUrl(
  url: string | null | undefined,
  opts: { w?: number; h?: number } = {},
): string | null {
  if (!url) return null;
  const w = opts.w ?? 800;
  const parts = ["f_auto", "q_auto", `w_${w}`];
  if (opts.h) parts.push(`h_${opts.h}`, "c_fill");

  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", `/upload/${parts.join(",")}/`);
  }
  return url;
}

export function setMetaTag(property: string, content: string) {
  const isOg = property.startsWith("og:");
  const attr = isOg ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function applyHotelSeo(input: {
  name: string;
  description?: string | null;
  image?: string | null;
}) {
  document.title = `${input.name} · Reservas`;
  setMetaTag("og:title", `${input.name} · Reservas`);
  if (input.description) {
    setMetaTag("og:description", input.description);
    setMetaTag("description", input.description);
  }
  if (input.image) {
    setMetaTag("og:image", input.image);
  }
}
