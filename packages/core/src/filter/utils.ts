import {
  $ZodTuple,
  type $ZodObject,
  type $ZodType,
  type $ZodTypes,
} from "zod/v4/core";
import type { FnSchema, GenericFnSchema, StandardFnSchema } from "../types.js";
import { unreachable } from "../utils.js";
import type {
  FilterArgExpression,
  FilterDateOffsetDuration,
  FilterField,
  FilterGroup,
  FilterGroupInput,
  FilterId,
  FilterPath,
  FilterRule,
  SingleFilter,
  SingleFilterInput,
} from "./types.js";
import { normalizeFilter } from "./validation.js";

export const and =
  <T extends (...args: any[]) => boolean>(...fnArray: NoInfer<T>[]) =>
  (...args: Parameters<T>) =>
    fnArray.every((fn) => fn(...args));

export const or =
  <T extends (...args: any[]) => boolean>(...fnArray: NoInfer<T>[]) =>
  (...args: Parameters<T>) =>
    fnArray.some((fn) => fn(...args));

export const instantiateGenericFn = (
  schema: $ZodType,
  genericFn: GenericFnSchema,
): StandardFnSchema | undefined => {
  if (!genericFn.genericLimit(schema as $ZodTypes)) {
    return;
  }
  return {
    name: genericFn.name,
    define: genericFn.define(schema),
    implement: genericFn.implement,
    skipValidate: genericFn.skipValidate,
    meta: {
      ...genericFn.meta,
      datatype: schema,
      genericFn: genericFn,
    },
  };
};

export const getFirstParameters = (fnSchema: StandardFnSchema) => {
  const fullParameters = fnSchema.define._zod.def.input as $ZodTuple;
  if (!fullParameters._zod.def.items.length) {
    console.error("Invalid filter parameters!", fnSchema, fullParameters);
    throw new Error("Invalid filter parameters!");
  }

  return fullParameters._zod.def.items.at(0)!;
};

/**
 * Returns all parameters from a function schema except the first.
 *
 * If the function schema has no parameters, it will throw an error.
 *
 * Glossary
 *
 * **Parameter** is the variable in the declaration of the function.
 * **Argument** is the actual value of this variable that gets passed to the function.
 */
export const getParametersExceptFirst = (
  fnSchema: StandardFnSchema,
): $ZodTuple => {
  const fullParameters = fnSchema.define._zod.def.input as $ZodTuple;
  if (!fullParameters._zod.def.items.length) {
    console.error("Invalid fnSchema parameters!", fnSchema, fullParameters);
    throw new Error("Invalid fnSchema parameters!");
  }

  const stillNeed = fullParameters._zod.def.items.slice(1);
  const rest = fullParameters._zod.def.rest;
  return new $ZodTuple({
    type: "tuple",
    items: stillNeed,
    rest,
  });
};

export const countNumberOfRules = (rule: FilterRule): number => {
  if (rule.type === "Filter") {
    return 1;
  }
  if (rule.type === "FilterGroup") {
    return rule.conditions.reduce((acc, r) => acc + countNumberOfRules(r), 0);
  }
  unreachable(rule);
};

export const countValidRules = ({
  filterFnList,
  dataSchema,
  rule,
}: {
  filterFnList: FnSchema[];
  dataSchema: $ZodType;
  rule: FilterRule;
}): number => {
  const strictRule = normalizeFilter({
    filterFnList,
    dataSchema,
    rule,
  });
  if (!strictRule) {
    return 0;
  }
  return countNumberOfRules(strictRule);
};

export function genFilterId(): FilterId {
  return Math.random().toString(36).slice(2, 9) as FilterId;
}

export const createSingleFilter = (
  ruleInput: SingleFilterInput = {
    args: [],
  },
) =>
  ({
    id: genFilterId(),
    type: "Filter",
    args: [],
    ...ruleInput,
  }) satisfies SingleFilter;

export const createFilterGroup = (ruleInput?: FilterGroupInput) =>
  ({
    id: genFilterId(),
    type: "FilterGroup",
    op: "and",
    conditions: [],
    ...ruleInput,
  }) satisfies FilterGroup;

/**
 * Creates a default rule based on the provided filterable fields.
 *
 * By default, it will auto-select the first field and the first filter.
 */
export const createDefaultRule = (
  filterableFields: FilterField[],
  { autoSelectFirstField = true, autoSelectFirstFilter = true } = {
    /**
     * If there is no filterable fields, it will return an empty rule.
     */
    autoSelectFirstField: true,
    autoSelectFirstFilter: true,
  },
): SingleFilter => {
  const firstField = filterableFields[0];
  if (!firstField) {
    console.error("No filterable fields", filterableFields);
    return createSingleFilter();
  }
  const newRule = createSingleFilter({
    path: autoSelectFirstField ? firstField.path : undefined,
    name: autoSelectFirstFilter ? firstField.filterFnList[0]?.name : undefined,
  });
  return newRule;
};

export const isEqualPath = (a: FilterPath, b: FilterPath): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((v, i) => v === b[i]);
};

export const bfsSchemaField = (
  schema: $ZodType,
  maxDeep: number,
  walk: (field: $ZodType, path: FilterPath) => void,
) => {
  const queue = [
    {
      schema,
      path: [] as FilterPath,
      deep: 0,
    },
  ];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.deep > maxDeep) break;

    walk(current.schema, current.path);

    const currentSchema = current.schema as $ZodTypes;
    if (currentSchema._zod.def.type !== "object") continue;

    const fields = currentSchema._zod.def.shape;
    for (const key in fields) {
      const field = fields[key];
      if (!field) continue;
      queue.push({
        schema: field,
        path: [...current.path, key] as FilterPath,
        deep: current.deep + 1,
      });
    }
  }
};

/**
 * Simple get function
 * See https://gist.github.com/jeneg/9767afdcca45601ea44930ea03e0febf
 *
 * @example
 * ```ts
 * const obj = {
 *  selector: { to: { val: "val" } },
 *  target: [1, 2, { a: "test" }],
 * };
 *
 * get(obj, ["selector", "to", "val"]); // "val"
 * get(obj, ["target", 2, "a"]); // "test"
 */
export const getValueAtPath = <R = unknown>(obj: any, path: FilterPath): R => {
  if (!path || path.length === 0) {
    return obj;
  }
  let result = obj;
  for (const key of path) {
    if (result == null) {
      return result;
    }
    result = result[key];
  }
  return result;
};

/**
 * This function retrieves the schema from a given path within a Zod schema.
 */
export const getSchemaAtPath = <T extends $ZodType = $ZodType>(
  schema: $ZodType,
  path: FilterPath,
  defaultValue?: T,
): T | undefined => {
  if (!path || path.length === 0) {
    return schema as T;
  }
  let result: $ZodType | undefined = schema;
  for (const key of path) {
    if (result == null) {
      return defaultValue as T;
    }
    if (result._zod.def.type !== "object") {
      return defaultValue as T;
    }
    result = (result as $ZodObject)._zod.def.shape[key];
  }
  return result as T;
};

const expressionTypes = new Set([
  "field",
  "literal",
  "binary",
  "dateOffset",
] satisfies FilterArgExpression["type"][]);

const dateOffsetDurationKeys = [
  "years",
  "months",
  "days",
] satisfies (keyof FilterDateOffsetDuration)[];

const isDateOffsetDuration = (
  value: unknown,
): value is FilterDateOffsetDuration => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const duration = value as Partial<
    Record<keyof FilterDateOffsetDuration, unknown>
  >;
  for (const key of dateOffsetDurationKeys) {
    if (key in duration && !isFilterArgExpression(duration[key])) {
      return false;
    }
  }
  return dateOffsetDurationKeys.some((key) => key in duration);
};

export const isFilterArgExpression = (
  value: unknown,
): value is FilterArgExpression => {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }
  if (
    typeof value.type !== "string" ||
    !expressionTypes.has(value.type as FilterArgExpression["type"])
  ) {
    return false;
  }
  if (value.type === "field") {
    return "path" in value && Array.isArray(value.path);
  }
  if (value.type === "literal") {
    return "value" in value;
  }
  if (value.type === "binary") {
    return (
      "op" in value &&
      ["add", "subtract", "multiply", "divide"].includes(String(value.op)) &&
      "left" in value &&
      isFilterArgExpression(value.left) &&
      "right" in value &&
      isFilterArgExpression(value.right)
    );
  }
  if (value.type === "dateOffset") {
    if (
      !(
        "base" in value &&
        isFilterArgExpression(value.base) &&
        "op" in value &&
        ["add", "subtract"].includes(String(value.op))
      )
    ) {
      return false;
    }
    if ("duration" in value) {
      return isDateOffsetDuration(value.duration);
    }
    return (
      "amount" in value &&
      isFilterArgExpression(value.amount) &&
      "unit" in value &&
      value.unit === "day"
    );
  }
  return false;
};

export const resolveFilterArgExpression = <Data>(
  expression: FilterArgExpression,
  data: Data,
): unknown => {
  if (expression.type === "field") {
    return getValueAtPath(data, expression.path);
  }
  if (expression.type === "literal") {
    return expression.value;
  }
  if (expression.type === "binary") {
    const left = resolveFilterArgExpression(expression.left, data);
    const right = resolveFilterArgExpression(expression.right, data);
    if (typeof left !== "number" || typeof right !== "number") {
      throw new Error("Binary filter argument expression requires numbers");
    }
    if (expression.op === "add") {
      return left + right;
    }
    if (expression.op === "subtract") {
      return left - right;
    }
    if (expression.op === "multiply") {
      return left * right;
    }
    if (expression.op === "divide") {
      if (right === 0) {
        throw new Error("Cannot divide filter argument expression by zero");
      }
      return left / right;
    }
    unreachable(expression.op);
  }
  if (expression.type === "dateOffset") {
    const base = resolveFilterArgExpression(expression.base, data);
    if (!(base instanceof Date)) {
      throw new Error(
        "Date offset filter argument expression requires a date base",
      );
    }
    const direction = expression.op === "add" ? 1 : -1;
    const duration = "duration" in expression ? expression.duration : undefined;
    if (duration) {
      const result = new Date(base.getTime());
      for (const key of dateOffsetDurationKeys) {
        const partExpression = duration[key];
        if (!partExpression) {
          continue;
        }
        const value = resolveFilterArgExpression(partExpression, data);
        if (typeof value !== "number") {
          throw new Error(
            "Date offset filter argument duration requires numbers",
          );
        }
        const amount = direction * value;
        if (key === "years") {
          result.setFullYear(result.getFullYear() + amount);
        }
        if (key === "months") {
          result.setMonth(result.getMonth() + amount);
        }
        if (key === "days") {
          result.setDate(result.getDate() + amount);
        }
      }
      return result;
    }
    const legacyAmount = "amount" in expression ? expression.amount : undefined;
    if (!legacyAmount) {
      throw new Error(
        "Date offset filter argument expression requires duration or amount",
      );
    }
    const amount = resolveFilterArgExpression(legacyAmount, data);
    if (typeof amount !== "number") {
      throw new Error(
        "Date offset filter argument expression requires a number amount",
      );
    }
    const offset = amount * 24 * 60 * 60 * 1000;
    return new Date(base.getTime() + direction * offset);
  }
  unreachable(expression);
};

export const resolveFilterArg = <Data>(arg: unknown, data: Data): unknown => {
  if (!isFilterArgExpression(arg)) {
    return arg;
  }
  return resolveFilterArgExpression(arg, data);
};
