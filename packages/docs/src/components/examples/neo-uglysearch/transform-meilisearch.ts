import type { FilterGroup, SingleFilter } from "@fn-sphere/filter";
import { z } from "zod";
import { filterFnList } from "./schema";

// Define operator mapping
const FILTER_OPERATORS: Record<string, string> = {
  equals: "=",
  notEqual: "!=",
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

const BINARY_OPERATORS: Record<string, string> = {
  add: "+",
  subtract: "-",
  multiply: "*",
  divide: "/",
};

type FilterArgExpressionLike =
  | {
      type: "field";
      path: (string | number)[];
    }
  | {
      type: "literal";
      value: unknown;
    }
  | {
      type: "binary";
      op: keyof typeof BINARY_OPERATORS;
      left: unknown;
      right: unknown;
    }
  | {
      type: "abs";
      value: unknown;
    }
  | {
      type: "dateOffset";
      base: unknown;
      op: "add" | "subtract";
      amount?: unknown;
      unit?: "day";
      duration?: {
        years?: unknown;
        months?: unknown;
        days?: unknown;
      };
    };

/**
 * Checks if a filter is unary (takes 0 or 1 parameters)
 *
 * Unary filters include operations like isEmpty, isNotEmpty etc.
 */
const checkUnaryFilter = (filterName: string) => {
  // use `validateRule` from @fn-sphere/core in the future
  if (
    filterName === "absoluteDifferenceLessThan" ||
    filterName === "absoluteDifferenceLessThanOrEqual" ||
    filterName === "betweenDaysBefore" ||
    filterName === "betweenDaysBeforeExclusive"
  ) {
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

const isExpressionLike = (value: unknown): value is FilterArgExpressionLike => {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }
  const type = String((value as { type: unknown }).type);
  return ["field", "literal", "binary", "abs", "dateOffset"].includes(type);
};

const formatDateLiteral = (value: Date): string => {
  return `sec(${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()})`;
};

const renderLiteral = (value: unknown): string => {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return formatDateLiteral(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(renderLiteral).join(", ")}]`;
  }
  return String(value);
};

const renderArg = (value: unknown): string => {
  if (!isExpressionLike(value)) {
    return renderLiteral(value);
  }
  if (value.type === "field") {
    return renderPath(value.path);
  }
  if (value.type === "literal") {
    return renderLiteral(value.value);
  }
  if (value.type === "binary") {
    const operator = BINARY_OPERATORS[value.op];
    return `(${renderArg(value.left)} ${operator} ${renderArg(value.right)})`;
  }
  if (value.type === "abs") {
    return `ABS(${renderArg(value.value)})`;
  }

  const base = renderArg(value.base);
  const direction = value.op === "add" ? "+" : "-";
  if ("duration" in value && value.duration) {
    const durationParts = [
      ["years", "years"],
      ["months", "months"],
      ["days", "days"],
    ] as const;
    const parts = durationParts
      .map(([key, unit]) => {
        const amount = value.duration?.[key];
        return amount === undefined
          ? undefined
          : `${renderArg(amount)} ${unit}`;
      })
      .filter((part) => part !== undefined);
    return `DATE_OFFSET(${base}, ${direction} ${parts.join(", ")})`;
  }
  return `DATE_OFFSET(${base}, ${direction} ${renderArg(value.amount)} days)`;
};

const transformAbsoluteDifferenceFilter = (
  path: string,
  filter: SingleFilter,
  operator: "<" | "<=",
): string | null => {
  const other = filter.args[0];
  const threshold = filter.args[1];
  if (other === undefined || threshold === undefined) {
    return null;
  }
  return `ABS(${path} - ${renderArg(other)}) ${operator} ${renderArg(threshold)}`;
};

const transformBetweenDaysBeforeFilter = (
  path: string,
  filter: SingleFilter,
  inclusive: boolean,
): string | null => {
  const baseDate = filter.args[0];
  const minDays = filter.args[1];
  const maxDays = filter.args[2];
  if (
    baseDate === undefined ||
    minDays === undefined ||
    maxDays === undefined
  ) {
    return null;
  }

  const lowerOperator = inclusive ? ">=" : ">";
  const upperOperator = inclusive ? "<=" : "<";
  const base = renderArg(baseDate);
  const lowerBound = `DATE_OFFSET(${base}, - ${renderArg(maxDays)} days)`;
  const upperBound = `DATE_OFFSET(${base}, - ${renderArg(minDays)} days)`;
  return `${path} ${lowerOperator} ${lowerBound} AND ${path} ${upperOperator} ${upperBound}`;
};

function transformSingleFilter(filter: SingleFilter): string | null {
  const pathParts = filter.path;
  const path = pathParts ? renderPath(pathParts) : undefined;
  const operator = filter.name ? FILTER_OPERATORS[filter.name] : undefined;
  const value = filter.args[0];

  if (!filter.name || path === undefined) {
    return null;
  }

  if (filter.name === "absoluteDifferenceLessThan") {
    return transformAbsoluteDifferenceFilter(path, filter, "<");
  }
  if (filter.name === "absoluteDifferenceLessThanOrEqual") {
    return transformAbsoluteDifferenceFilter(path, filter, "<=");
  }
  if (filter.name === "betweenDaysBefore") {
    return transformBetweenDaysBeforeFilter(path, filter, true);
  }
  if (filter.name === "betweenDaysBeforeExclusive") {
    return transformBetweenDaysBeforeFilter(path, filter, false);
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
    return `${path} ${operator} ${renderLiteral(value)}`;
  }

  if (value === undefined) {
    return `${path} ${operator}`;
  }

  // Handle string values
  if (typeof value === "string") {
    return `${path} ${operator} "${value}"`;
  }

  return `${path} ${operator} ${renderArg(value)}`;
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
