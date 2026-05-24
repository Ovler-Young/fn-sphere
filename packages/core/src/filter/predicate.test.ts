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

  test("resolves field args against each data row", () => {
    const rowSchema = z.object({
      before: z.number(),
      after: z.number(),
    });
    const lessThan = defineTypedFn({
      name: "less than",
      define: z.function({
        input: [z.number(), z.number()],
        output: z.boolean(),
      }),
      implement: (value, target) => value < target,
    });
    const rule = createSingleFilter({
      path: ["after"],
      name: "less than",
      args: [{ type: "field", path: ["before"] }],
    });

    const predicate = createFilterPredicate({
      filterFnList: [lessThan],
      schema: rowSchema,
      filterRule: rule,
      fallbackValue: false,
      errorHandling: { catchError: false, logError: false },
    });

    expect(predicate({ before: 130, after: 120 })).toBe(true);
    expect(predicate({ before: 110, after: 125 })).toBe(false);
  });

  test("does not resolve ordinary object args that match the parameter schema", () => {
    const objectSchema = z.object({
      name: z.string(),
    });
    const objectArgSchema = z.object({
      type: z.literal("field"),
      path: z.array(z.union([z.string(), z.number()])),
    });
    const matchesObject = defineTypedFn({
      name: "matches object",
      define: z.function({
        input: [z.string(), objectArgSchema],
        output: z.boolean(),
      }),
      implement: (_value, arg) => arg.path[0] === "name",
    });
    const rule = createSingleFilter({
      path: ["name"],
      name: "matches object",
      args: [{ type: "field", path: ["name"] }],
    });

    const predicate = createFilterPredicate({
      filterFnList: [matchesObject],
      schema: objectSchema,
      filterRule: rule,
      fallbackValue: false,
      errorHandling: { catchError: false, logError: false },
    });

    expect(predicate({ name: "Alice" })).toBe(true);
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
