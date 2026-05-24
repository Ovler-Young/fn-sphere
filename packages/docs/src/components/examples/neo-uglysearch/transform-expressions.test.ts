import { createFilterGroup, createSingleFilter } from "@fn-sphere/filter";
import { describe, expect, test } from "vitest";
import { filterRuleToMeilisearch } from "./transform-meilisearch";
import { filterRuleToSQL } from "./transform-sql";

describe("neo uglysearch transformers", () => {
  test("renders field, binary, abs, and date offset expressions", () => {
    const rule = createFilterGroup({
      op: "and",
      conditions: [
        createSingleFilter({
          path: ["content_length"],
          name: "lessThan",
          args: [
            {
              type: "binary",
              op: "add",
              left: { type: "field", path: ["baseline_length"] },
              right: {
                type: "abs",
                value: { type: "literal", value: 20 },
              },
            },
          ],
        }),
        createSingleFilter({
          path: ["date"],
          name: "before",
          args: [
            {
              type: "dateOffset",
              base: { type: "field", path: ["published_at"] },
              op: "subtract",
              amount: { type: "literal", value: 7 },
              unit: "day",
            },
          ],
        }),
      ],
    });

    expect(filterRuleToSQL(rule)).toBe(
      "WHERE (content_length < (baseline_length + ABS(20)) AND date < DATE_SUB(published_at, INTERVAL 7 DAY))",
    );
    expect(filterRuleToMeilisearch(rule)).toBe("");
  });

  test("renders absolute difference filters", () => {
    const rule = createFilterGroup({
      op: "and",
      conditions: [
        createSingleFilter({
          path: ["content_length"],
          name: "absoluteDifferenceLessThan",
          args: [{ type: "field", path: ["expected_length"] }, 15],
        }),
        createSingleFilter({
          path: ["content_length"],
          name: "absoluteDifferenceLessThanOrEqual",
          args: [{ type: "field", path: ["target_length"] }, 5],
        }),
      ],
    });

    expect(filterRuleToSQL(rule)).toBe(
      "WHERE (ABS(content_length - expected_length) < 15 AND ABS(content_length - target_length) <= 5)",
    );
    expect(filterRuleToMeilisearch(rule)).toBe("");
  });

  test("renders inclusive and exclusive days-before date range filters", () => {
    const rule = createFilterGroup({
      op: "and",
      conditions: [
        createSingleFilter({
          path: ["admission_date"],
          name: "betweenDaysBefore",
          args: [{ type: "field", path: ["discharge_date"] }, 7, 14],
        }),
        createSingleFilter({
          path: ["visit_date"],
          name: "betweenDaysBeforeExclusive",
          args: [{ type: "field", path: ["index_date"] }, 1, 3],
        }),
      ],
    });

    expect(filterRuleToSQL(rule)).toBe(
      "WHERE (admission_date >= DATE_SUB(discharge_date, INTERVAL 14 DAY) AND admission_date <= DATE_SUB(discharge_date, INTERVAL 7 DAY) AND visit_date > DATE_SUB(index_date, INTERVAL 3 DAY) AND visit_date < DATE_SUB(index_date, INTERVAL 1 DAY))",
    );
    expect(filterRuleToMeilisearch(rule)).toBe("");
  });

  test("omits unsupported Meilisearch conditions while keeping simple filters", () => {
    const rule = createFilterGroup({
      op: "and",
      conditions: [
        createSingleFilter({
          path: ["title"],
          name: "equals",
          args: ["Filter Sphere"],
        }),
        createSingleFilter({
          path: ["content_length"],
          name: "absoluteDifferenceLessThan",
          args: [{ type: "field", path: ["expected_length"] }, 15],
        }),
      ],
    });

    expect(filterRuleToMeilisearch(rule)).toBe('(title = "Filter Sphere")');
  });

  test("escapes Meilisearch string literals", () => {
    const rule = createFilterGroup({
      op: "and",
      conditions: [
        createSingleFilter({
          path: ["title"],
          name: "equals",
          args: ['He said "hi" \\ done'],
        }),
        createSingleFilter({
          path: ["tags"],
          name: "contains",
          args: ['tag "quoted" \\ value'],
        }),
      ],
    });

    expect(filterRuleToMeilisearch(rule)).toBe(
      '(title = "He said \\"hi\\" \\\\ done" AND tags CONTAINS "tag \\"quoted\\" \\\\ value")',
    );
  });
});
