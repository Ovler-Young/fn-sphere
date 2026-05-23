import { z } from "zod";
import { isSameType } from "zod-compare";
import type { $ZodTuple, $ZodType, $ZodTypes } from "zod/v4/core";
import { isGenericFilter } from "../fn-helpers.js";
import type { FnSchema, StandardFnSchema } from "../types.js";
import { unreachable } from "../utils.js";
import type {
  FilterArgExpression,
  FilterDateOffsetDuration,
  FilterGroup,
  FilterRule,
  SingleFilter,
  StrictFilterGroup,
  StrictFilterRule,
  StrictSingleFilter,
} from "./types.js";
import {
  getFirstParameters,
  getParametersExceptFirst,
  getSchemaAtPath,
  instantiateGenericFn,
  isFilterArgExpression,
} from "./utils.js";

type ValidateSuccess = {
  success: true;
};

type ValidateError = {
  success: false;
  error: Error;
};

/**
 * find filterFnSchema from `filterFnList` base `rule.name`
 *
 * If filterFnSchema is a generic fn schema,
 * try instantiate generic fn to a StandardFnSchema.
 * The generic type is `getSchemaAtPath(dataSchema, rule.path)`
 */
const getRuleFilterSchemaResult = ({
  filterFnList,
  dataSchema,
  rule,
}: {
  filterFnList: FnSchema[];
  dataSchema: $ZodType;
  rule: StrictSingleFilter;
}): (ValidateSuccess & { data: StandardFnSchema }) | ValidateError => {
  const fnSchema = filterFnList.find((f) => f.name === rule.name);
  if (!fnSchema) {
    return {
      success: false,
      error: new Error(`filterFnList not have filter: ${rule.name}`),
    };
  }
  const isGeneric = isGenericFilter(fnSchema);
  if (!isGeneric) {
    return {
      success: true,
      data: fnSchema,
    };
  }
  const targetSchema = getSchemaAtPath(dataSchema, rule.path);
  if (!targetSchema) {
    return {
      success: false,
      error: new Error(`Failed to get schema at path ${rule.path.join(".")}`),
    };
  }
  const standardFn = instantiateGenericFn(targetSchema, fnSchema);
  if (!standardFn) {
    return {
      success: false,
      error: new Error("Failed to instantiate generic filter"),
    };
  }
  return {
    success: true,
    data: standardFn,
  };
};

export const getRuleFilterSchema = (payload: {
  rule: StrictSingleFilter;
  filterFnList: FnSchema[];
  dataSchema: $ZodType;
}) => {
  const result = getRuleFilterSchemaResult(payload);
  if (!result.success) {
    return;
  }
  return result.data;
};

const validateStandardFnRule = ({
  fnSchema,
  dataSchema,
  rule,
}: {
  fnSchema: StandardFnSchema;
  dataSchema: $ZodType;
  rule: StrictSingleFilter;
}): ValidateSuccess | ValidateError => {
  if (rule.name !== fnSchema.name) {
    return {
      success: false,
      error: new Error(
        `rule.name not match fnSchema.name, ${rule.name} !== ${fnSchema.name}`,
      ),
    };
  }
  const targetSchema = getSchemaAtPath(dataSchema, rule.path);
  if (!targetSchema) {
    return {
      success: false,
      error: new Error(`dataSchema not have path: ${rule.path.join(".")}`),
    };
  }
  const dataParameters = getFirstParameters(fnSchema);
  const dataMatchFn = isSameType(dataParameters, targetSchema);
  if (!dataMatchFn) {
    return {
      success: false,
      error: new Error(
        `fnParameters not match dataSchema at path: ${rule.path.join(".")}`,
      ),
    };
  }

  const requiredParameters = getParametersExceptFirst(fnSchema);

  if (requiredParameters._zod.def.items.length !== rule.args.length) {
    return {
      success: false,
      error: new Error(
        `rule.args length not match required parameters length, ${rule.args.length} !== ${requiredParameters._zod.def.items.length}`,
      ),
    };
  }

  const expressionResult = validateRuleArgs({
    dataSchema,
    requiredParameters,
    args: rule.args,
    validateLiteral: !fnSchema.skipValidate,
  });
  if (expressionResult) {
    return expressionResult;
  }

  if (!fnSchema.skipValidate) {
    const parseResult = z.safeParse(requiredParameters, rule.args);
    return parseResult;
  }
  return {
    success: true,
  };
};

const getSchemaType = (schema: $ZodType) => (schema as $ZodTypes)._zod.def.type;

const numberSchema = z.number();
const dateSchema = z.date();
const stringSchema = z.string();
const booleanSchema = z.boolean();

const dateOffsetDurationKeys = [
  "years",
  "months",
  "days",
] satisfies (keyof FilterDateOffsetDuration)[];

const isCompatibleExpressionSchema = (
  targetSchema: $ZodType,
  expressionSchema: $ZodType,
) => {
  return (
    getSchemaType(targetSchema) === "any" ||
    getSchemaType(expressionSchema) === "any" ||
    getSchemaType(targetSchema) === getSchemaType(expressionSchema) ||
    isSameType(targetSchema, expressionSchema)
  );
};

const inferExpressionSchema = ({
  dataSchema,
  expression,
  expectedSchema,
}: {
  dataSchema: $ZodType;
  expression: FilterArgExpression;
  expectedSchema?: $ZodType | undefined;
}): (ValidateSuccess & { data: $ZodType }) | ValidateError => {
  if (expression.type === "field") {
    const fieldSchema = getSchemaAtPath(dataSchema, expression.path);
    if (!fieldSchema) {
      return {
        success: false,
        error: new Error(
          `dataSchema not have expression path: ${expression.path.join(".")}`,
        ),
      };
    }
    return { success: true, data: fieldSchema };
  }
  if (expression.type === "literal") {
    if (typeof expression.value === "number") {
      return { success: true, data: numberSchema };
    }
    if (typeof expression.value === "string") {
      return { success: true, data: stringSchema };
    }
    if (typeof expression.value === "boolean") {
      return { success: true, data: booleanSchema };
    }
    if (expression.value instanceof Date) {
      return { success: true, data: dateSchema };
    }
    if (expectedSchema) {
      const parseResult = z.safeParse(expectedSchema, expression.value);
      if (!parseResult.success) {
        return parseResult;
      }
      return { success: true, data: expectedSchema };
    }
    return { success: true, data: z.any() };
  }
  if (expression.type === "binary") {
    const left = inferExpressionSchema({
      dataSchema,
      expression: expression.left,
      expectedSchema: numberSchema,
    });
    if (!left.success) return left;
    const right = inferExpressionSchema({
      dataSchema,
      expression: expression.right,
      expectedSchema: numberSchema,
    });
    if (!right.success) return right;
    if (
      !isCompatibleExpressionSchema(numberSchema, left.data) ||
      !isCompatibleExpressionSchema(numberSchema, right.data)
    ) {
      return {
        success: false,
        error: new Error("binary expression requires number operands"),
      };
    }
    return { success: true, data: numberSchema };
  }
  if (expression.type === "dateOffset") {
    const base = inferExpressionSchema({
      dataSchema,
      expression: expression.base,
    });
    if (!base.success) return base;
    if (!isCompatibleExpressionSchema(dateSchema, base.data)) {
      return {
        success: false,
        error: new Error("date offset expression requires a date base"),
      };
    }
    const duration = "duration" in expression ? expression.duration : undefined;
    if (duration) {
      for (const key of dateOffsetDurationKeys) {
        const durationPart = duration[key];
        if (!durationPart) {
          continue;
        }
        const part = inferExpressionSchema({
          dataSchema,
          expression: durationPart,
          expectedSchema: numberSchema,
        });
        if (!part.success) return part;
        if (!isCompatibleExpressionSchema(numberSchema, part.data)) {
          return {
            success: false,
            error: new Error(
              "date offset expression requires number duration parts",
            ),
          };
        }
      }
      return { success: true, data: dateSchema };
    }
    const legacyAmount = "amount" in expression ? expression.amount : undefined;
    if (!legacyAmount) {
      return {
        success: false,
        error: new Error(
          "date offset expression requires duration or day amount",
        ),
      };
    }
    const amount = inferExpressionSchema({
      dataSchema,
      expression: legacyAmount,
      expectedSchema: numberSchema,
    });
    if (!amount.success) return amount;
    if (!isCompatibleExpressionSchema(numberSchema, amount.data)) {
      return {
        success: false,
        error: new Error(
          "date offset expression requires a date base and number day amount",
        ),
      };
    }
    return { success: true, data: dateSchema };
  }
  unreachable(expression);
};

const validateRuleArgs = ({
  dataSchema,
  requiredParameters,
  args,
  validateLiteral,
}: {
  dataSchema: $ZodType;
  requiredParameters: $ZodTuple;
  args: unknown[];
  validateLiteral: boolean;
}): ValidateSuccess | ValidateError | undefined => {
  const parameterSchemas = requiredParameters._zod.def.items;
  let hasExpression = false;
  for (const [index, arg] of args.entries()) {
    const parameterSchema = parameterSchemas[index];
    if (!parameterSchema) {
      return {
        success: false,
        error: new Error(`argument has no parameter at ${index}`),
      };
    }
    if (!isFilterArgExpression(arg)) {
      if (validateLiteral) {
        const parseResult = z.safeParse(parameterSchema as $ZodType, arg);
        if (!parseResult.success) {
          return parseResult;
        }
      }
      continue;
    }
    if (z.safeParse(parameterSchema as $ZodType, arg).success) {
      continue;
    }
    hasExpression = true;
    if (arg.type === "literal") {
      if (validateLiteral) {
        const parseResult = z.safeParse(parameterSchema as $ZodType, arg.value);
        if (!parseResult.success) {
          return parseResult;
        }
      }
      continue;
    }
    const expressionResult = inferExpressionSchema({
      dataSchema,
      expression: arg,
      expectedSchema: parameterSchema as $ZodType,
    });
    if (!expressionResult.success) {
      return expressionResult;
    }
    if (
      !isCompatibleExpressionSchema(
        parameterSchema as $ZodType,
        expressionResult.data,
      )
    ) {
      return {
        success: false,
        error: new Error(`expression argument not match parameter at ${index}`),
      };
    }
  }
  return hasExpression ? { success: true } : undefined;
};

export const validateRule = ({
  filterFnList,
  dataSchema,
  rule,
}: {
  filterFnList: FnSchema[];
  dataSchema: $ZodType;
  rule: SingleFilter;
}): ValidateSuccess | ValidateError => {
  const fnSchema = filterFnList.find((f) => f.name === rule.name);
  if (!fnSchema) {
    return {
      success: false,
      error: new Error(`filterFnList not have filter: ${rule.name}`),
    };
  }
  if (!rule.name) {
    return {
      success: false,
      error: new Error("rule.name not found"),
    };
  }
  if (!rule.path) {
    return {
      success: false,
      error: new Error("rule.path not found"),
    };
  }
  const strictRule: StrictSingleFilter = {
    ...rule,
    name: rule.name,
    path: rule.path,
    invert: !!rule.invert,
  };
  const standardFnResult = getRuleFilterSchemaResult({
    filterFnList,
    dataSchema,
    rule: strictRule,
  });
  if (!standardFnResult.success) {
    return standardFnResult;
  }
  return validateStandardFnRule({
    fnSchema: standardFnResult.data,
    dataSchema,
    rule: {
      ...rule,
      name: rule.name,
      path: rule.path,
      invert: !!rule.invert,
    },
  });
};

export const isValidRule = ({
  filterFnList,
  dataSchema,
  rule,
}: {
  filterFnList: FnSchema[];
  dataSchema: $ZodType;
  rule: SingleFilter;
}): boolean => {
  const result = validateRule({
    filterFnList,
    dataSchema,
    rule,
  });
  return result.success;
};

export const validateGroup = ({
  filterFnList,
  dataSchema,
  ruleGroup,
}: {
  filterFnList: FnSchema[];
  dataSchema: $ZodType;
  ruleGroup: FilterGroup;
}): ValidateSuccess | ValidateError => {
  for (const rule of ruleGroup.conditions) {
    if (rule.type === "FilterGroup") {
      const result = validateGroup({
        filterFnList,
        dataSchema,
        ruleGroup: rule,
      });
      if (!result.success) {
        return result;
      }
      return result;
    }
    const result = validateRule({
      filterFnList,
      dataSchema,
      rule,
    });
    if (!result.success) {
      return result;
    }
  }
  return {
    success: true,
  };
};

/**
 * - Remove empty group
 * - Remove invalid filter
 * - If filter is not ready, return `undefined`
 */
export const normalizeFilter = ({
  filterFnList,
  dataSchema,
  rule,
}: {
  filterFnList: FnSchema[];
  dataSchema: $ZodType;
  rule: FilterRule;
}): StrictFilterRule | undefined => {
  if (rule.type === "Filter") {
    // User may not select filter name or field
    if (!rule.name || !rule.path) return;
    const result = validateRule({
      filterFnList,
      dataSchema,
      rule,
    });
    if (!result.success) return;
    return {
      ...rule,
      name: rule.name,
      path: rule.path,
      invert: !!rule.invert,
    } satisfies StrictSingleFilter;
  }
  if (rule.type === "FilterGroup") {
    // if (!rule.conditions.length) return;
    const conditions: StrictFilterRule[] = rule.conditions
      .map((condition) =>
        normalizeFilter({
          filterFnList,
          dataSchema,
          rule: condition,
        }),
      )
      .filter((i): i is StrictFilterRule => !!i);
    if (!conditions.length) {
      return;
    }
    return {
      ...rule,
      conditions,
      invert: !!rule.invert,
    } satisfies StrictFilterGroup;
  }
  unreachable(rule, "Invalid filter type!");
};
