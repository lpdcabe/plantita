// Stable randomness: a new milestone gets a new shape, but existing branches
// keep their positions across renders, watering, devices, and printed cards.
export function branchLayout(seed, type, index) {
  let hash = 2166136261;
  for (const character of `${seed}:${type}:${index}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const random = () => {
    hash += 0x6D2B79F5;
    let value = Math.imul(hash ^ hash >>> 15, 1 | hash);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  const side = random() < .5 ? -1 : 1;
  // Separate height bands keep successive flowers from piling onto one spot.
  const x = 80 + side * (24 + random() * 18);
  const y = [99, 73, 43][index % 3] + random() * 12;
  return { x, y, baseY: 120 + random() * 12, bend: x + side * (3 + random() * 6), angle: (random() - .5) * 28, size: .85 + random() * .25 };
}
