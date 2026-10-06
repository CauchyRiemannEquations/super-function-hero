export type Theme = "rooftops" | "city" | "factory" | "night";
export type Palette = {
  sky: string;
  haze: string;
  far: string;
  near: string;
  detail: string;
  glass: string;
  ground: string;
  edge: string;
  accent: string;
};
export const PALETTES: Record<Theme, Palette> = {
  rooftops: {
    sky: "#b3c8f3",
    haze: "#ffdec8",
    far: "#adaed3",
    near: "#9c8ab5",
    detail: "#685f89",
    glass: "#f4dca6",
    ground: "#434163",
    edge: "#20223c",
    accent: "#27dce5",
  },
  city: {
    sky: "#96bbdc",
    haze: "#d3eddf",
    far: "#96b7c6",
    near: "#6c91ac",
    detail: "#476680",
    glass: "#b4f4e6",
    ground: "#394f62",
    edge: "#1f3346",
    accent: "#37e0d0",
  },
  factory: {
    sky: "#c7a8ae",
    haze: "#ffd3a3",
    far: "#ad9195",
    near: "#8b7584",
    detail: "#564b67",
    glass: "#ffcd77",
    ground: "#4f465a",
    edge: "#2e2a42",
    accent: "#ffad53",
  },
  night: {
    sky: "#171632",
    haze: "#4b3b69",
    far: "#35385c",
    near: "#2c304c",
    detail: "#1d203a",
    glass: "#63e5e8",
    ground: "#262a43",
    edge: "#121629",
    accent: "#b084ff",
  },
};
export function blendColor(a: string, b: string, t: number) {
  const n = Number.parseInt(a.slice(1), 16),
    m = Number.parseInt(b.slice(1), 16);
  return (
    "#" +
    [16, 8, 0]
      .map((s) =>
        Math.round(((n >> s) & 255) * (1 - t) + ((m >> s) & 255) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function blendPalette(a: Palette, b: Palette, t: number): Palette {
  return Object.fromEntries(
    Object.keys(a).map((key) => [
      key,
      blendColor(a[key as keyof Palette], b[key as keyof Palette], t),
    ]),
  ) as Palette;
}
