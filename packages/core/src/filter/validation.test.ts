import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { $ZodNumber, $ZodString } from "zod/v4/core";
import { defineGenericFn, defineTypedFn } from "../fn-helpers.js";
import { dateFilter, numberFilter } from "../fn/filter.js";
import type { FnSchema } from "../types.js";
import type { FilterId, SingleFilter } from "./types.js";
import { createFilterGroup, createSingleFilter } from "./utils.js";
import { isValidRule, normalizeFilter } from "./validation.js";

describe("isValidRule", () => {
  const filterFnList: FnSchema[] = [
    defineTypedFn({
      name: "Starts with",
      define: z.function({
        input: [z.string(), z.string()],
        output: z.boolean(),
      }),
      implement: (value, target) => value.startsWith(target),
      skipValidate: true,
    }),
    defineTypedFn({
      name: "Is checked",
      define: z.function({ input: [z.boolean()], output: z.boolean() }),
      implement: (value) => value === true,
      skipValidate: true,
    }),
  ];

  const mockDataSchema = z.object({
    name: z.string(),
    boolean: z.boolean(),
  });

  it("should return false for a no input rule", () => {
    const rule: SingleFilter = {
      id: "1" as FilterId,
      type: "Filter",
      name: "Starts with",
      path: ["name"],
      args: [],
    };

    const result = isValidRule({
      filterFnList: filterFnList,
      dataSchema: mockDataSchema,
      rule,
    });

    expect(result).toBe(false);
  });

  it("should return false for a no path rule", () => {
    const rule: SingleFilter = {
      id: "1" as FilterId,
      type: "Filter",
      name: "Starts with",
      args: [],
    };

    const result = isValidRule({
      filterFnList: filterFnList,
      dataSchema: mockDataSchema,
      rule,
    });

    expect(result).toBe(false);
  });

  it("should return false for a error path rule", () => {
    const rule: SingleFilter = {
      id: "1" as FilterId,
      type: "Filter",
      name: "Starts with",
      path: ["boolean"],
      args: [],
    };

    const result = isValidRule({
      filterFnList: filterFnList,
      dataSchema: mockDataSchema,
      rule,
    });

    expect(result).toBe(false);
  });

  it("should return false for a error name rule", () => {
    const rule: SingleFilter = {
      id: "1" as FilterId,
      type: "Filter",
      name: "no this filter",
      path: ["name"],
      args: ["data"],
    };

    const result = isValidRule({
      filterFnList: filterFnList,
      dataSchema: mockDataSchema,
      rule,
    });

    expect(result).toBe(false);
  });

  it("should return true for a string rule", () => {
    const rule: SingleFilter = {
      id: "1" as FilterId,
      type: "Filter",
      name: "Starts with",
      path: ["name"],
      args: ["data"],
    };

    const result = isValidRule({
      filterFnList: filterFnList,
      dataSchema: mockDataSchema,
      rule,
    });

    expect(result).toBe(true);
  });

  it("should return true for a boolean rule", () => {
    const rule: SingleFilter = {
      id: "1" as FilterId,
      type: "Filter",
      name: "Is checked",
      path: ["boolean"],
      args: [],
    };

    const result = isValidRule({
      filterFnList: filterFnList,
      dataSchema: mockDataSchema,
      rule,
    });

    expect(result).toBe(true);
  });

  it("should return false when no input for skip validate standard fn", () => {
    const rule: SingleFilter = {
      id: "1" as FilterId,
      type: "Filter",
      name: "Equals",
      path: ["name"],
      args: [],
    };

    const standardFn = defineTypedFn({
      name: "Equals",
      define: z.function({
        input: [z.string(), z.string()],
        output: z.boolean(),
      }),
      implement: (value, target) => value === target,
      skipValidate: true,
    });

    const result = isValidRule({
      filterFnList: [standardFn],
      dataSchema: mockDataSchema,
      rule,
    });

    expect(result).toBe(false);

    rule.args = ["data"];
    const newResult = isValidRule({
      filterFnList: [standardFn],
      dataSchema: mockDataSchema,
      rule,
    });
    expect(newResult).toBe(true);
  });

  it("should return false when no input for skip validate generic fn", () => {
    const rule: SingleFilter = {
      id: "1" as FilterId,
      type: "Filter",
      name: "Equals",
      path: ["name"],
      args: [],
    };

    const genericFn = defineGenericFn({
      name: "Equals",
      genericLimit: (t): t is $ZodString | $ZodNumber => true,
      define: (t) => z.function({ input: [t, t], output: z.boolean() }),
      implement: (value: string | number, target: string | number) =>
        value === target,
      skipValidate: true,
    });

    const result = isValidRule({
      filterFnList: [genericFn],
      dataSchema: mockDataSchema,
      rule,
    });

    expect(result).toBe(false);

    rule.args = ["data"];
    const newResult = isValidRule({
      filterFnList: [genericFn],
      dataSchema: mockDataSchema,
      rule,
    });
    expect(newResult).toBe(true);
  });

  it("should check extra zod options when validate generic fn", () => {
    const emailSchema = z.object({
      email: z.string().email(),
    });
    const rule: SingleFilter = {
      id: "1" as FilterId,
      type: "Filter",
      name: "Equals",
      path: ["email"],
      args: [],
    };

    const genericFn = defineGenericFn({
      name: "Equals",
      genericLimit: (t): t is $ZodString | $ZodNumber => true,
      define: (t) => z.function({ input: [t, t], output: z.boolean() }),
      implement: (value: string | number, target: string | number) =>
        value === target,
    });

    rule.args = ["not email"];
    const result = isValidRule({
      filterFnList: [genericFn],
      dataSchema: emailSchema,
      rule,
    });

    expect(result).toBe(false);

    rule.args = ["foo@example.com"];
    const newResult = isValidRule({
      filterFnList: [genericFn],
      dataSchema: emailSchema,
      rule,
    });
    expect(newResult).toBe(true);
  });

  it("should validate field reference arguments", () => {
    const schema = z.object({
      name: z.string(),
      alias: z.string(),
      age: z.number(),
    });
    const genericFn = defineGenericFn({
      name: "Equals",
      genericLimit: (t): t is $ZodString | $ZodNumber => true,
      define: (t) => z.function({ input: [t, t], output: z.boolean() }),
      implement: (value: string | number, target: string | number) =>
        value === target,
    });
    const validRule = createSingleFilter({
      name: "Equals",
      path: ["name"],
      args: [{ type: "field", path: ["alias"] }],
    });
    const invalidRule = createSingleFilter({
      name: "Equals",
      path: ["name"],
      args: [{ type: "field", path: ["age"] }],
    });

    expect(
      isValidRule({
        filterFnList: [genericFn],
        dataSchema: schema,
        rule: validRule,
      }),
    ).toBe(true);
    expect(
      isValidRule({
        filterFnList: [genericFn],
        dataSchema: schema,
        rule: invalidRule,
      }),
    ).toBe(false);
  });

  it("should validate number expressions", () => {
    const schema = z.object({
      score: z.number(),
      multiplier: z.number(),
      name: z.string(),
    });
    const greaterThan = defineTypedFn({
      name: "Greater than",
      define: z.function({
        input: [z.number(), z.number()],
        output: z.boolean(),
      }),
      implement: (value, target) => value > target,
    });

    expect(
      isValidRule({
        filterFnList: [greaterThan],
        dataSchema: schema,
        rule: createSingleFilter({
          name: "Greater than",
          path: ["score"],
          args: [
            {
              type: "binary",
              op: "multiply",
              left: { type: "literal", value: 10 },
              right: { type: "field", path: ["multiplier"] },
            },
          ],
        }),
      }),
    ).toBe(true);
    expect(
      isValidRule({
        filterFnList: [greaterThan],
        dataSchema: schema,
        rule: createSingleFilter({
          name: "Greater than",
          path: ["score"],
          args: [
            {
              type: "binary",
              op: "multiply",
              left: { type: "literal", value: 10 },
              right: { type: "field", path: ["name"] },
            },
          ],
        }),
      }),
    ).toBe(false);
    expect(
      isValidRule({
        filterFnList: [greaterThan],
        dataSchema: schema,
        rule: createSingleFilter({
          name: "Greater than",
          path: ["score"],
          args: [
            {
              type: "binary",
              op: "multiply",
              left: { type: "literal", value: null },
              right: { type: "field", path: ["multiplier"] },
            },
          ],
        }),
      }),
    ).toBe(false);
  });

  it("should validate abs expressions for number arguments", () => {
    const schema = z.object({
      score: z.number(),
      baseline: z.number(),
      label: z.string(),
    });
    const lessThan = defineTypedFn({
      name: "Less than",
      define: z.function({
        input: [z.number(), z.number()],
        output: z.boolean(),
      }),
      implement: (value, target) => value < target,
    });

    expect(
      isValidRule({
        filterFnList: [lessThan],
        dataSchema: schema,
        rule: createSingleFilter({
          name: "Less than",
          path: ["score"],
          args: [
            {
              type: "abs",
              value: {
                type: "binary",
                op: "subtract",
                left: { type: "field", path: ["score"] },
                right: { type: "field", path: ["baseline"] },
              },
            },
          ],
        }),
      }),
    ).toBe(true);
    expect(
      isValidRule({
        filterFnList: [lessThan],
        dataSchema: schema,
        rule: createSingleFilter({
          name: "Less than",
          path: ["score"],
          args: [
            {
              type: "abs",
              value: { type: "field", path: ["label"] },
            },
          ],
        }),
      }),
    ).toBe(false);
  });

  it("should validate absolute difference filters", () => {
    const schema = z.object({
      systolicAtAdmission: z.number(),
      systolicAtDischarge: z.number(),
      label: z.string(),
    });

    expect(
      isValidRule({
        filterFnList: numberFilter,
        dataSchema: schema,
        rule: createSingleFilter({
          name: "absoluteDifferenceLessThan",
          path: ["systolicAtDischarge"],
          args: [{ type: "field", path: ["systolicAtAdmission"] }, 10],
        }),
      }),
    ).toBe(true);
    expect(
      isValidRule({
        filterFnList: numberFilter,
        dataSchema: schema,
        rule: createSingleFilter({
          name: "absoluteDifferenceLessThanOrEqual",
          path: ["systolicAtDischarge"],
          args: [{ type: "field", path: ["systolicAtAdmission"] }, 10],
        }),
      }),
    ).toBe(true);
    expect(
      isValidRule({
        filterFnList: numberFilter,
        dataSchema: schema,
        rule: createSingleFilter({
          name: "absoluteDifferenceLessThan",
          path: ["systolicAtDischarge"],
          args: [{ type: "field", path: ["label"] }, 10],
        }),
      }),
    ).toBe(false);
  });

  it("should validate date offset expressions", () => {
    const schema = z.object({
      birthday: z.date(),
      deadline: z.date(),
      offsetDays: z.number(),
      offsetMonths: z.number(),
      name: z.string(),
    });
    const before = defineTypedFn({
      name: "Before",
      define: z.function({ input: [z.date(), z.date()], output: z.boolean() }),
      implement: (value, target) => value.getTime() < target.getTime(),
    });

    expect(
      isValidRule({
        filterFnList: [before],
        dataSchema: schema,
        rule: createSingleFilter({
          name: "Before",
          path: ["birthday"],
          args: [
            {
              type: "dateOffset",
              base: { type: "field", path: ["deadline"] },
              op: "add",
              amount: { type: "field", path: ["offsetDays"] },
              unit: "day",
            },
          ],
        }),
      }),
    ).toBe(true);
    expect(
      isValidRule({
        filterFnList: [before],
        dataSchema: schema,
        rule: createSingleFilter({
          name: "Before",
          path: ["birthday"],
          args: [
            {
              type: "dateOffset",
              base: { type: "field", path: ["deadline"] },
              op: "add",
              duration: {
                years: { type: "literal", value: 1 },
                months: { type: "field", path: ["offsetMonths"] },
                days: { type: "field", path: ["offsetDays"] },
              },
            },
          ],
        }),
      }),
    ).toBe(true);
    expect(
      isValidRule({
        filterFnList: [before],
        dataSchema: schema,
        rule: createSingleFilter({
          name: "Before",
          path: ["birthday"],
          args: [
            {
              type: "dateOffset",
              base: { type: "field", path: ["deadline"] },
              op: "add",
              duration: {
                days: { type: "field", path: ["name"] },
              },
            },
          ],
        }),
      }),
    ).toBe(false);
    expect(
      isValidRule({
        filterFnList: [before],
        dataSchema: schema,
        rule: createSingleFilter({
          name: "Before",
          path: ["birthday"],
          args: [
            {
              type: "dateOffset",
              base: { type: "field", path: ["deadline"] },
              op: "add",
              duration: {
                days: { type: "literal", value: {} },
              },
            },
          ],
        }),
      }),
    ).toBe(false);
    expect(
      isValidRule({
        filterFnList: [before],
        dataSchema: schema,
        rule: createSingleFilter({
          name: "Before",
          path: ["birthday"],
          args: [
            {
              type: "dateOffset",
              base: { type: "literal", value: {} },
              op: "add",
              duration: {
                days: { type: "literal", value: 1 },
              },
            },
          ],
        }),
      }),
    ).toBe(false);
  });

  it("should validate days-before date range filters", () => {
    const schema = z.object({
      admissionDate: z.date(),
      dischargeDate: z.date(),
      label: z.string(),
    });

    expect(
      isValidRule({
        filterFnList: dateFilter,
        dataSchema: schema,
        rule: createSingleFilter({
          name: "betweenDaysBefore",
          path: ["admissionDate"],
          args: [{ type: "field", path: ["dischargeDate"] }, 7, 14],
        }),
      }),
    ).toBe(true);
    expect(
      isValidRule({
        filterFnList: dateFilter,
        dataSchema: schema,
        rule: createSingleFilter({
          name: "betweenDaysBeforeExclusive",
          path: ["admissionDate"],
          args: [{ type: "field", path: ["dischargeDate"] }, 7, 14],
        }),
      }),
    ).toBe(true);
    expect(
      isValidRule({
        filterFnList: dateFilter,
        dataSchema: schema,
        rule: createSingleFilter({
          name: "betweenDaysBefore",
          path: ["admissionDate"],
          args: [{ type: "field", path: ["label"] }, 7, 14],
        }),
      }),
    ).toBe(false);
    expect(
      isValidRule({
        filterFnList: dateFilter,
        dataSchema: schema,
        rule: createSingleFilter({
          name: "betweenDaysBefore",
          path: ["admissionDate"],
          args: [{ type: "field", path: ["dischargeDate"] }, "min", 14],
        }),
      }),
    ).toBe(false);
  });
});

describe("normalizeFilter", () => {
  const filterFnList: FnSchema[] = [
    defineTypedFn({
      name: "Starts with",
      define: z.function({
        input: [z.string(), z.string()],
        output: z.boolean(),
      }),
      implement: (value, target) => value.startsWith(target),
      skipValidate: true,
    }),
    defineTypedFn({
      name: "Is checked",
      define: z.function({ input: [z.boolean()], output: z.boolean() }),
      implement: (value) => value === true,
      skipValidate: true,
    }),
  ];

  const mockDataSchema = z.object({
    name: z.string(),
    boolean: z.boolean(),
  });

  it("should return undefined for a empty rule", () => {
    const rule = createSingleFilter();
    expect(
      normalizeFilter({ filterFnList, dataSchema: mockDataSchema, rule }),
    ).toBeUndefined();

    const group = createFilterGroup({
      op: "and",
      conditions: [rule],
    });
    expect(
      normalizeFilter({
        filterFnList,
        dataSchema: mockDataSchema,
        rule: group,
      }),
    ).toBeUndefined();
  });

  it("should return itself for a valid rule", () => {
    const rule = createSingleFilter({
      name: "Starts with",
      path: ["name"],
      args: ["str"],
    });
    expect(
      normalizeFilter({ filterFnList, dataSchema: mockDataSchema, rule }),
    ).toEqual({
      ...rule,
      invert: false,
    });

    const group = createFilterGroup({
      op: "and",
      conditions: [rule],
    });
    expect(
      normalizeFilter({
        filterFnList,
        dataSchema: mockDataSchema,
        rule: group,
      }),
    ).toEqual({
      ...group,
      invert: false,
      conditions: [
        {
          ...rule,
          invert: false,
        },
      ],
    });
  });

  it("should return filter without invalid rule", () => {
    const rule = createSingleFilter({
      name: "Starts with",
      path: ["name"],
      args: ["str"],
    });

    const group = createFilterGroup({
      op: "and",
      conditions: [createSingleFilter(), rule],
    });
    expect(
      normalizeFilter({
        filterFnList,
        dataSchema: mockDataSchema,
        rule: group,
      }),
    ).toEqual({
      ...group,
      invert: false,
      conditions: [
        {
          ...rule,
          invert: false,
        },
      ],
    });
  });
});
