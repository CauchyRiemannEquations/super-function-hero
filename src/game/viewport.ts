export const WORLD_HEIGHT = 460;

// Reserve a strip for thumbs, not a separate panel. The world keeps a single
// scale on both axes; physics and skill geometry do not change on rotation.
export function fitViewport(
  width: number,
  height: number,
  protectedBottom = 0,
) {
  const sceneHeight = Math.max(100, height - protectedBottom);
  const scale = sceneHeight / WORLD_HEIGHT;
  return { width: width / scale, height: height / scale, scale };
}
