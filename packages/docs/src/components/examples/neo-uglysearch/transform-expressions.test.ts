import { createFilterGroup, createSingleFilter } from "@fn-sphere/filter";
import { describe, expect, test } from "vitest";
import { filterRuleToMeilisearch } from "./transform-meilisearch";
import { filterRuleToSQL } from "./transform-sql";

describe("neo uglysearch field argument transformers", () => {
  test("renders field arguments in SQL filters", () => {
    const rule = createFilterGroup({
      op: "and",
      conditions: [
        createSingleFilter({
          path: ["content_length"],
          name: "lessThan",
          args: [{ type: "field", path: ["expected_length"] }],
        }),
      ],
    });

    expect(filterRuleToSQL(rule)).toBe(
      "WHERE (content_length < expected_length)",
    );
  });

  test("renders patient computed filters in SQL", () => {
    const rule = createFilterGroup({
      op: "and",
      conditions: [
        createSingleFilter({
          path: ["dischargeSystolic"],
          name: "less than selected field",
          args: [{ type: "field", path: ["admissionSystolic"] }],
        }),
        createSingleFilter({
          path: ["dischargeWeight"],
          name: "absolute difference from selected field is at most",
          args: [{ type: "field", path: ["admissionWeight"] }, 5],
        }),
        createSingleFilter({
          path: ["admissionDate"],
          name: "days before selected date between",
          args: [{ type: "field", path: ["dischargeDate"] }, 1, 14],
        }),
      ],
    });

    expect(filterRuleToSQL(rule)).toBe(
      "WHERE (dischargeSystolic < admissionSystolic AND ABS(dischargeWeight - admissionWeight) <= 5 AND admissionDate >= DATE_SUB(dischargeDate, INTERVAL 14 DAY) AND admissionDate <= DATE_SUB(dischargeDate, INTERVAL 1 DAY))",
    );
  });

  test("omits field arguments and computed filters in Meilisearch", () => {
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
          name: "lessThan",
          args: [{ type: "field", path: ["expected_length"] }],
        }),
        createSingleFilter({
          path: ["dischargeWeight"],
          name: "absolute difference from selected field is at most",
          args: [{ type: "field", path: ["admissionWeight"] }, 5],
        }),
      ],
    });

    expect(filterRuleToMeilisearch(rule)).toBe('(title = "Filter Sphere")');
  });
});
