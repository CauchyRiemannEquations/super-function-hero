import bot from "../assets/bot.png";
import drone from "../assets/drone.png";
import core from "../assets/core.png";
import spike from "../assets/spike.png";
import fracture from "../assets/fracture.png";
import logo from "../assets/logo.png";
import titleBackground from "../assets/title-background.png";

export const ART = { bot, drone, core, spike, fracture, logo, titleBackground };
type Sprite = "bot" | "drone" | "core" | "spike" | "fracture";
// Alpha bounds measured from supplied PNGs. Files remain unmodified.
const BOUNDS: Record<Sprite, number[]> = {
  bot: [343, 252, 580, 747],
  drone: [71, 390, 1122, 478],
  core: [148, 101, 968, 1062],
  spike: [32, 310, 1199, 633],
  fracture: [54, 448, 1171, 349],
};
const sprites = new Map<Sprite, HTMLCanvasElement>();
let loading: Promise<void> | undefined;
export function loadArt() {
  return (loading ??= Promise.allSettled(
    Object.entries(ART).map(async ([name, url]) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!(name in BOUNDS)) return;
      const [x, y, w, h] = BOUNDS[name as Sprite],
        scale = Math.min(1, 384 / Math.max(w, h));
      const surface = document.createElement("canvas");
      surface.width = Math.ceil(w * scale);
      surface.height = Math.ceil(h * scale);
      const c = surface.getContext("2d")!;
      c.imageSmoothingQuality = "high";
      c.drawImage(image, x, y, w, h, 0, 0, surface.width, surface.height);
      sprites.set(name as Sprite, surface);
    }),
  ).then(() => undefined));
}
export function drawSprite(
  c: CanvasRenderingContext2D,
  name: Sprite,
  x: number,
  y: number,
  w: number,
  h?: number,
) {
  const image = sprites.get(name);
  if (!image) return false;
  c.drawImage(image, x, y, w, h ?? (w * image.height) / image.width);
  return true;
}
export function artStatus() {
  return [...sprites.keys()];
}
