import type { $ZodType } from "zod/v4/core";
import type { StandardFnSchema } from "../types.js";

export type FilterPath = (string | number)[];

export type FilterFieldArgExpression = {
  type: "field";
  path: FilterPath;
};

export type FilterLiteralArgExpression = {
  type: "literal";
  value: unknown;
};

export type FilterBinaryArgExpression = {
  type: "binary";
  op: "add" | "subtract" | "multiply" | "divide";
  left: FilterArgExpression;
  right: FilterArgExpression;
};

export type FilterDateOffsetDuration = {
  years?: FilterArgExpression;
  months?: FilterArgExpression;
  days?: FilterArgExpression;
};

export type FilterDateOffsetArgExpression = {
  type: "dateOffset";
  base: FilterArgExpression;
  op: "add" | "subtract";
} & (
  | {
      amount: FilterArgExpression;
      unit: "day";
      duration?: never;
    }
  | {
      duration: FilterDateOffsetDuration;
      amount?: never;
      unit?: never;
    }
);

export type FilterArgExpression =
  | FilterFieldArgExpression
  | FilterLiteralArgExpression
  | FilterBinaryArgExpression
  | FilterDateOffsetArgExpression;

export type FilterId = string & {
  // Type differentiator only.
  __filterId: true;
};

export type FilterField = {
  /**
   * If it's a empty array, it means the root object
   */
  path: FilterPath;
  fieldSchema: $ZodType;
  filterFnList: StandardFnSchema[];
};

export interface SingleFilterInput {
  /**
   * Field path
   *
   * If it's a empty array, it means the root object.
   * If not provided, it means user didn't select a field.
   */
  path?: FilterPath | undefined;
  /**
   * Filter name
   *
   * If not provided, it means user didn't select a filter.
   */
  name?: string | undefined;
  /**
   * Arguments for the filter function
   */
  args?: unknown[];
  invert?: boolean;
  meta?: Record<string, unknown>;
}

export interface SingleFilter extends SingleFilterInput {
  type: "Filter";
  /**
   * Unique id, used for tracking changes or resorting
   */
  id: FilterId;
  /**
   * Arguments for the filter function
   */
  args: unknown[];
}

export interface FilterGroupInput {
  op: "and" | "or";
  conditions?: FilterRule[];
  invert?: boolean;
  meta?: Record<string, unknown>;
}

export interface FilterGroup extends FilterGroupInput {
  type: "FilterGroup";
  /**
   * Unique id, used for tracking changes or resorting
   */
  id: FilterId;
  conditions: FilterRule[];
}

export type FilterRule = SingleFilter | FilterGroup;

export type StrictSingleFilter = Readonly<
  Required<Omit<SingleFilter, "meta">> & {
    name: string;
    path: FilterPath;
    meta?: Record<string, unknown>;
  }
>;
export type StrictFilterGroup = Readonly<{
  /**
   * Unique id, used for tracking changes or resorting
   */
  id: FilterId;
  type: "FilterGroup";
  op: "and" | "or";
  conditions: StrictFilterRule[];
  invert: boolean;
  meta?: Record<string, unknown>;
}>;

export type StrictFilterRule = StrictSingleFilter | StrictFilterGroup;
