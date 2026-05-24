import type { FilterGroup, SingleFilter } from "@fn-sphere/filter";
import { z } from "zod";
import { filterFnList } from "./schema";

const SQL_OPERATORS: Record<string, string> = {
  equals: "=",
  notEqual: "!=",
  greaterThan: ">",
  greaterThanOrEqual: ">=",
  lessThan: "<",
  lessThanOrEqual: "<=",
  contains: "LIKE",
  startsWith: "LIKE",
  isEmpty: "IS NULL",
  isNotEmpty: "IS NOT NULL",
  before: "<",
  after: ">",
};

const BINARY_SQL_OPERATORS: Record<string, string> = {
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
      op: keyof typeof BINARY_SQL_OPERATORS;
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

const checkUnaryFilter = (filterName: string) => {
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

function escapeSQL(value: string): string {
  return value.replace(/'/g, "''");
}

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
  return `'${value.toISOString().split("T")[0]}'`;
};

const renderSQLLiteral = (value: unknown): string => {
  if (typeof value === "string") {
    return `'${escapeSQL(value)}'`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return formatDateLiteral(value);
  }
  if (Array.isArray(value)) {
    return `(${value.map(renderSQLLiteral).join(", ")})`;
  }
  return String(value);
};

const renderSQLArg = (value: unknown): string => {
  if (!isExpressionLike(value)) {
    return renderSQLLiteral(value);
  }
  if (value.type === "field") {
    return renderPath(value.path);
  }
  if (value.type === "literal") {
    return renderSQLLiteral(value.value);
  }
  if (value.type === "binary") {
    const operator = BINARY_SQL_OPERATORS[value.op];
    return `(${renderSQLArg(value.left)} ${operator} ${renderSQLArg(value.right)})`;
  }
  if (value.type === "abs") {
    return `ABS(${renderSQLArg(value.value)})`;
  }

  const base = renderSQLArg(value.base);
  const direction = value.op === "add" ? 1 : -1;
  const renderOffset = (amount: unknown, unit: "DAY" | "MONTH" | "YEAR") => {
    const functionName = direction === 1 ? "DATE_ADD" : "DATE_SUB";
    return `${functionName}(${base}, INTERVAL ${renderSQLArg(amount)} ${unit})`;
  };

  if ("duration" in value && value.duration) {
    let result = base;
    const durationParts = [
      ["years", "YEAR"],
      ["months", "MONTH"],
      ["days", "DAY"],
    ] as const;
    for (const [key, unit] of durationParts) {
      const amount = value.duration[key];
      if (amount === undefined) {
        continue;
      }
      const functionName = direction === 1 ? "DATE_ADD" : "DATE_SUB";
      result = `${functionName}(${result}, INTERVAL ${renderSQLArg(amount)} ${unit})`;
    }
    return result;
  }

  return renderOffset(value.amount, "DAY");
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
  return `ABS(${path} - ${renderSQLArg(other)}) ${operator} ${renderSQLArg(threshold)}`;
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
  const base = renderSQLArg(baseDate);
  const lowerBound = `DATE_SUB(${base}, INTERVAL ${renderSQLArg(maxDays)} DAY)`;
  const upperBound = `DATE_SUB(${base}, INTERVAL ${renderSQLArg(minDays)} DAY)`;
  return `${path} ${lowerOperator} ${lowerBound} AND ${path} ${upperOperator} ${upperBound}`;
};

function transformSingleFilter(filter: SingleFilter): string | null {
  const pathParts = filter.path;
  const path = pathParts ? renderPath(pathParts) : undefined;
  const operator = filter.name ? SQL_OPERATORS[filter.name] : undefined;
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

  // Handle array values for IN/NOT IN
  if (Array.isArray(value)) {
    const items = value.map(renderSQLLiteral).join(", ");
    return `${path} ${operator} (${items})`;
  }

  // Unary operators
  if (value === undefined) {
    return `${path} ${operator}`;
  }

  // LIKE patterns for contains/startsWith
  if (typeof value === "string") {
    const escaped = escapeSQL(value);
    if (filter.name === "contains") {
      return `${path} ${operator} '%${escaped}%'`;
    }
    if (filter.name === "startsWith") {
      return `${path} ${operator} '${escaped}%'`;
    }
    return `${path} ${operator} '${escaped}'`;
  }

  return `${path} ${operator} ${renderSQLArg(value)}`;
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
 * Transforms a FilterGroup object into a SQL WHERE clause.
 *
 * WARNING: This is for demonstration purposes only. The output uses string
 * concatenation and is NOT safe against SQL injection. In production, always
 * use parameterized queries or prepared statements.
 *
 * @example
 * ```ts
 * filterRuleToSQL({
 *   type: "FilterGroup",
 *   op: "and",
 *   conditions: [{
 *     type: "Filter",
 *     path: ["title"],
 *     name: "equals",
 *     args: ["hello world"]
 *   }]
 * })
 * // "WHERE (title = 'hello world')"
 * ```
 *
 * @deprecated This function is for demonstration purposes only and should not be used in production due to SQL injection risks. Always use parameterized queries or prepared statements in real applications.
 */
export const filterRuleToSQL = (filterGroup: FilterGroup) => {
  const where = transformFilterGroup(filterGroup);
  if (!where) return "";
  return `WHERE ${where}`;
};
