import type { FilterGroup, SingleFilter } from "@fn-sphere/filter";
import { z } from "zod";
import { filterFnList } from "./schema";

const SQL_OPERATORS: Record<string, string> = {
  equals: "=",
  notEqual: "!=",
  notEquals: "!=",
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

const PATIENT_FILTER_NAMES = {
  lessThanField: "less than field",
  absoluteDifferenceAtMost: "absolute difference from field is at most",
  daysBeforeBetween: "days before date between",
} as const;

type FieldArgLike = {
  type: "field";
  path: (string | number)[];
};

const checkUnaryFilter = (filterName: string) => {
  if (Object.values(PATIENT_FILTER_NAMES).includes(filterName as never)) {
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

const renderSQLLiteral = (value: unknown): string => {
  if (typeof value === "string") {
    return `'${escapeSQL(value)}'`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return `'${value.toISOString().split("T")[0]}'`;
  }
  if (Array.isArray(value)) {
    return `(${value.map(renderSQLLiteral).join(", ")})`;
  }
  return String(value);
};

const renderSQLArg = (value: unknown): string => {
  if (isFieldArgLike(value)) {
    return renderPath(value.path);
  }
  return renderSQLLiteral(value);
};

const transformAbsoluteDifferenceAtMostFilter = (
  path: string,
  filter: SingleFilter,
): string | null => {
  const other = filter.args[0];
  const threshold = filter.args[1];
  if (other === undefined || threshold === undefined) {
    return null;
  }
  return `ABS(${path} - ${renderSQLArg(other)}) <= ${renderSQLArg(threshold)}`;
};

const transformDaysBeforeBetweenFilter = (
  path: string,
  filter: SingleFilter,
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

  const base = renderSQLArg(baseDate);
  const lowerBound = `DATE_SUB(${base}, INTERVAL ${renderSQLArg(maxDays)} DAY)`;
  const upperBound = `DATE_SUB(${base}, INTERVAL ${renderSQLArg(minDays)} DAY)`;
  return `${path} >= ${lowerBound} AND ${path} <= ${upperBound}`;
};

function transformSingleFilter(filter: SingleFilter): string | null {
  const path = filter.path ? renderPath(filter.path) : undefined;
  const operator = filter.name ? SQL_OPERATORS[filter.name] : undefined;
  const value = filter.args[0];

  if (!filter.name || path === undefined) {
    return null;
  }

  if (filter.name === PATIENT_FILTER_NAMES.lessThanField) {
    return value === undefined ? null : `${path} < ${renderSQLArg(value)}`;
  }
  if (filter.name === PATIENT_FILTER_NAMES.absoluteDifferenceAtMost) {
    return transformAbsoluteDifferenceAtMostFilter(path, filter);
  }
  if (filter.name === PATIENT_FILTER_NAMES.daysBeforeBetween) {
    return transformDaysBeforeBetweenFilter(path, filter);
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
