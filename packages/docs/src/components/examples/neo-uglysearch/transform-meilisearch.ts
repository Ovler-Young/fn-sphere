import type { FilterGroup, SingleFilter } from "@fn-sphere/filter";
import { z } from "zod";
import { filterFnList } from "./schema";

// Define operator mapping
const FILTER_OPERATORS: Record<string, string> = {
  equals: "=",
  notEqual: "!=",
  notEquals: "!=",
  greaterThan: ">",
  greaterThanOrEqual: ">=",
  lessThan: "<",
  lessThanOrEqual: "<=",
  contains: "CONTAINS",
  notContains: "NOT CONTAINS",
  startsWith: "STARTS WITH",
  isEmpty: "IS EMPTY",
  isNotEmpty: "IS NOT EMPTY",
  before: "<",
  after: ">",
};

const unsupportedComputedFilterNames = new Set([
  "less than field",
  "absolute difference from field is at most",
  "days before date between",
]);

type FieldArgLike = {
  type: "field";
  path: (string | number)[];
};

const isFieldArgLike = (value: unknown): value is FieldArgLike => {
  return (
    !!value &&
    typeof value === "object" &&
    "type" in value &&
    (value as { type: unknown }).type === "field" &&
    "path" in value &&
    Array.isArray((value as { path: unknown }).path)
  );
};

/**
 * Checks if a filter is unary (takes 0 or 1 parameters)
 *
 * Unary filters include operations like isEmpty, isNotEmpty etc.
 */
const checkUnaryFilter = (filterName: string) => {
  // use `validateRule` from @fn-sphere/core in the future
  if (unsupportedComputedFilterNames.has(filterName)) {
    return false;
  }
  const filterSchema = filterFnList.find((fn) => fn.name === filterName);
  if (!filterSchema) throw new Error("Unknown filter! " + filterName);
  const filterDefine =
    typeof filterSchema.define === "function"
      ? filterSchema.define(z.any())
      : filterSchema.define;
  const parameters = filterDefine._zod.def.input as z.ZodTuple;
  return parameters._zod.def.items.length <= 1;
};

const renderPath = (path: (string | number)[]): string => {
  return path.map(String).join(".");
};

const escapeMeiliString = (value: string): string => {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};

const renderMeiliValue = (value: unknown): string | null => {
  if (isFieldArgLike(value)) {
    return null;
  }
  if (typeof value === "string") {
    return `"${escapeMeiliString(value)}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return `sec(${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()})`;
  }
  if (Array.isArray(value)) {
    const items = value.map(renderMeiliValue);
    if (items.some((item) => item === null)) {
      return null;
    }
    return `[${items.join(", ")}]`;
  }
  return null;
};

function transformSingleFilter(filter: SingleFilter): string | null {
  const path = filter.path ? renderPath(filter.path) : undefined;
  const operator = filter.name ? FILTER_OPERATORS[filter.name] : undefined;
  const value = filter.args[0];

  if (!filter.name || path === undefined) {
    return null;
  }

  if (unsupportedComputedFilterNames.has(filter.name)) {
    return null;
  }

  if (operator === undefined) {
    return null;
  }
  const isUnaryFilter = checkUnaryFilter(filter.name);
  if (value === undefined && !isUnaryFilter) {
    return null;
  }

  // Handle array values for IN/NOT IN operators
  if (Array.isArray(value)) {
    const renderedValue = renderMeiliValue(value);
    return renderedValue === null
      ? null
      : `${path} ${operator} ${renderedValue}`;
  }

  if (value === undefined) {
    return `${path} ${operator}`;
  }

  const renderedValue = renderMeiliValue(value);
  if (renderedValue === null) {
    return null;
  }

  return `${path} ${operator} ${renderedValue}`;
}

function transformFilterGroup(filterGroup: FilterGroup): string | null {
  if (!filterGroup.conditions.length) return "";

  const conditions = filterGroup.conditions.map((condition) => {
    if (condition.type === "Filter") {
      return transformSingleFilter(condition);
    } else {
      return transformFilterGroup(condition);
    }
  });

  const operator = filterGroup.op.toUpperCase() as Uppercase<FilterGroup["op"]>;
  const result = conditions.filter((i) => i !== null).join(` ${operator} `);
  if (!result) {
    return null;
  }

  return `(${result})`;
}

/**
 * Transforms a FilterGroup object into a query string format for advanced search.
 *
 * @example
 * ```ts
 * filterRuleToMeilisearch({
 *   type: "FilterGroup",
 *   op: "and",
 *   conditions: [{
 *     type: "Filter",
 *     path: ["title"],
 *     name: "equals",
 *     args: ["hello world"]
 *   }]
 * })
 * // "(title = "hello world")"
 * ```
 */
export const filterRuleToMeilisearch = (filterGroup: FilterGroup) => {
  return transformFilterGroup(filterGroup) ?? "";
};
