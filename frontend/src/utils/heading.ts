// atan2 on the last two points of a trace -- 0 degrees is "pointing up" to
// match TrackMap's car marker default orientation. Shared by TrackMap
// (live mode, using the store's own trailing history) and SimulationPage
// (historical mode, using the replayed lap's trailing history) so both
// compute heading identically.
export const headingFromTrail = (trail: { x: number; y: number }[]): number => {
  if (trail.length < 2) return 0;
  const a = trail[trail.length - 2];
  const b = trail[trail.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
};
