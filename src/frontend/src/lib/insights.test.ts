import type { ObstacleStat } from "@/types/index";
import { describe, expect, it } from "vitest";
import {
  aggregateObstacles,
  rankActualObstacles,
  rankExpectedObstacles,
  totalActualOccurrences,
} from "./insights";

function obstacle(
  obstacleName: string,
  count: bigint,
  obstacleTemplateId?: bigint,
): ObstacleStat {
  return { obstacleName, count, obstacleTemplateId };
}

describe("aggregateObstacles", () => {
  it("sums counts by obstacle name across habits", () => {
    const result = aggregateObstacles([
      obstacle("Low Energy", 2n, 1n),
      obstacle("No Time", 1n, 2n),
      obstacle("Low Energy", 3n, 1n),
    ]);
    expect(result).toEqual([
      obstacle("Low Energy", 5n, 1n),
      obstacle("No Time", 1n, 2n),
    ]);
  });

  it("returns an empty array for no obstacles", () => {
    expect(aggregateObstacles([])).toEqual([]);
  });
});

describe("totalActualOccurrences", () => {
  it("sums every occurrence across all obstacles", () => {
    expect(
      totalActualOccurrences([
        obstacle("Low Energy", 2n),
        obstacle("No Time", 1n),
      ]),
    ).toBe(3n);
  });

  it("is zero when there are no obstacles", () => {
    expect(totalActualOccurrences([])).toBe(0n);
  });
});

describe("rankActualObstacles", () => {
  it("drops obstacles that never repeated (count < 2)", () => {
    const result = rankActualObstacles([
      obstacle("Low Energy", 3n),
      obstacle("No Time", 1n),
    ]);
    expect(result.map((o) => o.obstacleName)).toEqual(["Low Energy"]);
  });

  it("keeps only the top 2 by count", () => {
    const result = rankActualObstacles([
      obstacle("Low Energy", 5n),
      obstacle("No Time", 4n),
      obstacle("Distraction", 3n),
    ]);
    expect(result.map((o) => o.obstacleName)).toEqual([
      "Low Energy",
      "No Time",
    ]);
  });

  it("returns an empty array when nothing reaches the repeat threshold", () => {
    expect(
      rankActualObstacles([
        obstacle("Low Energy", 1n),
        obstacle("No Time", 1n),
      ]),
    ).toEqual([]);
  });
});

describe("rankExpectedObstacles", () => {
  it("orders by how many habits predicted each obstacle", () => {
    const result = rankExpectedObstacles(
      [obstacle("No Time", 1n, 2n), obstacle("Low Energy", 3n, 1n)],
      [],
    );
    expect(result.map((o) => o.obstacleName)).toEqual([
      "Low Energy",
      "No Time",
    ]);
  });

  it("breaks prediction-count ties by actual occurrence count", () => {
    const result = rankExpectedObstacles(
      [obstacle("No Time", 2n, 2n), obstacle("Low Energy", 2n, 1n)],
      [obstacle("No Time", 5n, 2n), obstacle("Low Energy", 1n, 1n)],
    );
    expect(result.map((o) => o.obstacleName)).toEqual([
      "No Time",
      "Low Energy",
    ]);
  });

  it("breaks remaining ties by obstacle template id", () => {
    const result = rankExpectedObstacles(
      [obstacle("No Time", 2n, 9n), obstacle("Low Energy", 2n, 3n)],
      [],
    );
    expect(result.map((o) => o.obstacleName)).toEqual([
      "Low Energy",
      "No Time",
    ]);
  });

  it("keeps only the top 3", () => {
    const result = rankExpectedObstacles(
      [
        obstacle("A", 4n, 1n),
        obstacle("B", 3n, 2n),
        obstacle("C", 2n, 3n),
        obstacle("D", 1n, 4n),
      ],
      [],
    );
    expect(result.map((o) => o.obstacleName)).toEqual(["A", "B", "C"]);
  });
});
