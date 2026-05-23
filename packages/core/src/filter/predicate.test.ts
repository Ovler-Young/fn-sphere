import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { defineTypedFn } from "../fn-helpers.js";
import { createFilterPredicate } from "./predicate.js";
import type { FilterRule } from "./types.js";
import { createSingleFilter } from "./utils.js";

describe("createFilterPredicate", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });

  type Data = z.infer<typeof schema>;

  const filterFnList = [
    defineTypedFn({
      name: "equals",
      define: z.function({
        input: [z.string(), z.string()],
        output: z.boolean(),
      }),
      implement: (value, target) => value === target,
    }),
  ];

  test("uses default error handling (catch errors, log, return fallbackValue)", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const errorFn = defineTypedFn({
      name: "error filter",
      define: z.function({
        input: [z.string()],
        output: z.boolean(),
      }),
      implement: () => {
        throw new Error("Test error");
      },
    });

    const rule = createSingleFilter({
      path: ["name"],
      name: "error filter",
      args: [],
    });

    const predicate = createFilterPredicate({
      filterFnList: [errorFn],
      schema,
      filterRule: rule,
    });

    const data: Data = { name: "Alice", age: 30 };
    const result = predicate(data);

    expect(result).toBe(true); // default fallbackValue
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Filter predicate error:",
      rule,
      data,
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  test("returns fallbackValue on error when catchError is true", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const errorFn = defineTypedFn({
      name: "error filter",
      define: z.function({
        input: [z.string()],
        output: z.boolean(),
      }),
      implement: () => {
        throw new Error("Test error");
      },
    });

    const rule = createSingleFilter({
      path: ["name"],
      name: "error filter",
      args: [],
    });

    const predicate = createFilterPredicate({
      filterFnList: [errorFn],
      schema,
      filterRule: rule,
      fallbackValue: false,
      errorHandling: { catchError: true, logError: false },
    });

    const result = predicate({ name: "Alice", age: 30 });

    expect(result).toBe(false);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test("throws error when catchError is false", () => {
    const errorFn = defineTypedFn({
      name: "error filter",
      define: z.function({
        input: [z.string()],
        output: z.boolean(),
      }),
      implement: () => {
        throw new Error("Test error");
      },
    });

    const rule = createSingleFilter({
      path: ["name"],
      name: "error filter",
      args: [],
    });

    const predicate = createFilterPredicate({
      filterFnList: [errorFn],
      schema,
      filterRule: rule,
      errorHandling: { catchError: false, logError: false },
    });

    expect(() => predicate({ name: "Alice", age: 30 })).toThrow("Test error");
  });

  test("logs error when logError is true", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const errorFn = defineTypedFn({
      name: "error filter",
      define: z.function({
        input: [z.string()],
        output: z.boolean(),
      }),
      implement: () => {
        throw new Error("Test error");
      },
    });

    const rule = createSingleFilter({
      path: ["name"],
      name: "error filter",
      args: [],
    });

    const predicate = createFilterPredicate({
      filterFnList: [errorFn],
      schema,
      filterRule: rule,
      fallbackValue: true,
      errorHandling: { catchError: true, logError: true },
    });

    predicate({ name: "Alice", age: 30 });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Filter predicate error:",
      rule,
      { name: "Alice", age: 30 },
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  test("does not log error when logError is false", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const errorFn = defineTypedFn({
      name: "error filter",
      define: z.function({
        input: [z.string()],
        output: z.boolean(),
      }),
      implement: () => {
        throw new Error("Test error");
      },
    });

    const rule = createSingleFilter({
      path: ["name"],
      name: "error filter",
      args: [],
    });

    const predicate = createFilterPredicate({
      filterFnList: [errorFn],
      schema,
      filterRule: rule,
      fallbackValue: true,
      errorHandling: { catchError: true, logError: false },
    });

    predicate({ name: "Alice", age: 30 });

    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test("works correctly when no error occurs", () => {
    const rule = createSingleFilter({
      path: ["name"],
      name: "equals",
      args: ["Alice"],
    });

    const predicate = createFilterPredicate({
      filterFnList,
      schema,
      filterRule: rule,
      fallbackValue: false,
      errorHandling: { catchError: true, logError: true },
    });

    expect(predicate({ name: "Alice", age: 30 })).toBe(true);
    expect(predicate({ name: "Bob", age: 25 })).toBe(false);
  });

  test("resolves field reference arguments", () => {
    const extendedSchema = z.object({
      name: z.string(),
      alias: z.string(),
      age: z.number(),
      minAge: z.number(),
    });
    const rule = createSingleFilter({
      path: ["name"],
      name: "equals",
      args: [{ type: "field", path: ["alias"] }],
    });
    const predicate = createFilterPredicate({
      filterFnList,
      schema: extendedSchema,
      filterRule: rule,
      fallbackValue: false,
    });

    expect(
      predicate({ name: "Alice", alias: "Alice", age: 30, minAge: 18 }),
    ).toBe(true);
    expect(
      predicate({ name: "Alice", alias: "Bob", age: 30, minAge: 18 }),
    ).toBe(false);
  });

  test("keeps legacy object literal arguments unchanged", () => {
    const objectSchema = z.object({
      name: z.string(),
    });
    const objectEquals = defineTypedFn({
      name: "objectEquals",
      define: z.function({
        input: [
          z.string(),
          z.object({
            type: z.literal("field"),
            path: z.array(z.string()),
          }),
        ],
        output: z.boolean(),
      }),
      implement: (value, target) => value === target.path[0],
    });
    const rule = createSingleFilter({
      path: ["name"],
      name: "objectEquals",
      args: [{ type: "field", path: ["Alice"] }],
    });
    const predicate = createFilterPredicate({
      filterFnList: [objectEquals],
      schema: objectSchema,
      filterRule: rule,
      fallbackValue: false,
    });

    expect(predicate({ name: "Alice" })).toBe(true);
  });

  test("resolves numeric binary expression arguments", () => {
    const numericSchema = z.object({
      score: z.number(),
      multiplier: z.number(),
    });
    const greaterThan = defineTypedFn({
      name: "greaterThan",
      define: z.function({
        input: [z.number(), z.number()],
        output: z.boolean(),
      }),
      implement: (value, target) => value > target,
    });
    const rule = createSingleFilter({
      path: ["score"],
      name: "greaterThan",
      args: [
        {
          type: "binary",
          op: "multiply",
          left: { type: "literal", value: 10 },
          right: { type: "field", path: ["multiplier"] },
        },
      ],
    });
    const predicate = createFilterPredicate({
      filterFnList: [greaterThan],
      schema: numericSchema,
      filterRule: rule,
      fallbackValue: false,
    });

    expect(predicate({ score: 31, multiplier: 3 })).toBe(true);
    expect(predicate({ score: 29, multiplier: 3 })).toBe(false);
  });

  test("resolves date offset expression arguments", () => {
    const dateSchema = z.object({
      birthday: z.date(),
      deadline: z.date(),
    });
    const before = defineTypedFn({
      name: "before",
      define: z.function({
        input: [z.date(), z.date()],
        output: z.boolean(),
      }),
      implement: (value, target) => value.getTime() < target.getTime(),
    });
    const rule = createSingleFilter({
      path: ["birthday"],
      name: "before",
      args: [
        {
          type: "dateOffset",
          base: { type: "field", path: ["deadline"] },
          op: "add",
          amount: { type: "literal", value: 10 },
          unit: "day",
        },
      ],
    });
    const predicate = createFilterPredicate({
      filterFnList: [before],
      schema: dateSchema,
      filterRule: rule,
      fallbackValue: false,
    });

    expect(
      predicate({
        birthday: new Date("2026-01-10"),
        deadline: new Date("2026-01-01"),
      }),
    ).toBe(true);
    expect(
      predicate({
        birthday: new Date("2026-01-20"),
        deadline: new Date("2026-01-01"),
      }),
    ).toBe(false);
  });

  test("resolves date offset duration expression arguments", () => {
    const dateSchema = z.object({
      birthday: z.date(),
      deadline: z.date(),
      offsetMonths: z.number(),
    });
    const before = defineTypedFn({
      name: "before",
      define: z.function({
        input: [z.date(), z.date()],
        output: z.boolean(),
      }),
      implement: (value, target) => value.getTime() < target.getTime(),
    });
    const rule = createSingleFilter({
      path: ["birthday"],
      name: "before",
      args: [
        {
          type: "dateOffset",
          base: { type: "field", path: ["deadline"] },
          op: "add",
          duration: {
            years: { type: "literal", value: 1 },
            months: { type: "field", path: ["offsetMonths"] },
            days: { type: "literal", value: 10 },
          },
        },
      ],
    });
    const predicate = createFilterPredicate({
      filterFnList: [before],
      schema: dateSchema,
      filterRule: rule,
      fallbackValue: false,
    });

    expect(
      predicate({
        birthday: new Date("2027-03-10"),
        deadline: new Date("2026-01-01"),
        offsetMonths: 2,
      }),
    ).toBe(true);
    expect(
      predicate({
        birthday: new Date("2027-03-20"),
        deadline: new Date("2026-01-01"),
        offsetMonths: 2,
      }),
    ).toBe(false);
  });

  test("returns fallbackValue when expression resolution fails", () => {
    const numericSchema = z.object({
      score: z.number(),
    });
    const greaterThan = defineTypedFn({
      name: "greaterThan",
      define: z.function({
        input: [z.number(), z.number()],
        output: z.boolean(),
      }),
      implement: (value, target) => value > target,
    });
    const rule = createSingleFilter({
      path: ["score"],
      name: "greaterThan",
      args: [
        {
          type: "binary",
          op: "divide",
          left: { type: "literal", value: 10 },
          right: { type: "literal", value: 0 },
        },
      ],
    });
    const predicate = createFilterPredicate({
      filterFnList: [greaterThan],
      schema: numericSchema,
      filterRule: rule,
      fallbackValue: false,
      errorHandling: { catchError: true, logError: false },
    });

    expect(predicate({ score: 20 })).toBe(false);
  });

  test("returns fallbackValue when filterRule is undefined", () => {
    const predicateTrue = createFilterPredicate({
      filterFnList,
      schema,
      filterRule: undefined as unknown as FilterRule,
      fallbackValue: true,
    });

    const predicateFalse = createFilterPredicate({
      filterFnList,
      schema,
      filterRule: undefined as unknown as FilterRule,
      fallbackValue: false,
    });

    expect(predicateTrue({ name: "Alice", age: 30 })).toBe(true);
    expect(predicateFalse({ name: "Alice", age: 30 })).toBe(false);
  });
});
