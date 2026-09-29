import type { ObstacleStat } from "@/types/index";

/** Minimum total recorded actual-obstacle occurrences before the obstacles
 *  section surfaces any real rows. */
export const OBSTACLE_EVIDENCE_MIN = 3;

/** An actual obstacle must repeat at least this many times to be listed. */
export const OBSTACLE_ACTUAL_MIN_COUNT = 2;

/** How many rows each obstacle column shows. */
export const OBSTACLE_ACTUAL_LIMIT = 2;
export const OBSTACLE_EXPECTED_LIMIT = 3;

/**
 * Sum obstacle counts across every habit's own actual-obstacle list, pooling
 * by obstacle name. Returns a new array sorted by descending count; ties keep
 * the order in which the names were first seen.
 */
export function aggregateObstacles(obstacles: ObstacleStat[]): ObstacleStat[] {
  const byName = new Map<string, ObstacleStat>();
  for (const obstacle of obstacles) {
    const existing = byName.get(obstacle.obstacleName);
    if (existing) {
      existing.count = existing.count + obstacle.count;
    } else {
      byName.set(obstacle.obstacleName, { ...obstacle });
    }
  }
  return [...byName.values()].sort((a, b) => Number(b.count - a.count));
}

/** Total number of recorded actual-obstacle occurrences across all habits. */
export function totalActualOccurrences(obstacles: ObstacleStat[]): bigint {
  return obstacles.reduce((sum, obstacle) => sum + obstacle.count, 0n);
}

/**
 * The "Actual" column: only obstacles that repeated at least
 * OBSTACLE_ACTUAL_MIN_COUNT times, top OBSTACLE_ACTUAL_LIMIT by count.
 */
export function rankActualObstacles(obstacles: ObstacleStat[]): ObstacleStat[] {
  return aggregateObstacles(obstacles)
    .filter((obstacle) => obstacle.count >= BigInt(OBSTACLE_ACTUAL_MIN_COUNT))
    .slice(0, OBSTACLE_ACTUAL_LIMIT);
}

/**
 * The "Expected" column: the pooled predicted obstacles, top
 * OBSTACLE_EXPECTED_LIMIT, ordered by how many habits predicted each one
 * (descending). Ties break by how often the obstacle actually occurred
 * (descending), then by obstacle template id (ascending) for a stable order.
 *
 * `predicted` is the backend's cross-habit pooled list, where each entry's
 * `count` is the number of habits that predicted it. `actual` is the pooled
 * actual-obstacle list used only for tie-breaking.
 */
export function rankExpectedObstacles(
  predicted: ObstacleStat[],
  actual: ObstacleStat[],
): ObstacleStat[] {
  const actualByName = new Map(
    actual.map((obstacle) => [obstacle.obstacleName, obstacle.count]),
  );

  return [...predicted]
    .sort((a, b) => {
      const byPredicted = Number(b.count - a.count);
      if (byPredicted !== 0) return byPredicted;

      const actualA = actualByName.get(a.obstacleName) ?? 0n;
      const actualB = actualByName.get(b.obstacleName) ?? 0n;
      const byActual = Number(actualB - actualA);
      if (byActual !== 0) return byActual;

      const idA = a.obstacleTemplateId ?? 0n;
      const idB = b.obstacleTemplateId ?? 0n;
      return Number(idA - idB);
    })
    .slice(0, OBSTACLE_EXPECTED_LIMIT);
}
