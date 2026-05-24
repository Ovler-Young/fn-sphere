import { useEffect, useMemo, type ReactNode } from "react";
import { z } from "zod";
import {
  isEqualPath,
  isFilterArgExpression,
  isSameType,
} from "@fn-sphere/core";
import type {
  FilterArgExpression,
  FilterBinaryArgExpression,
  FilterDateOffsetArgExpression,
  FilterDateOffsetDuration,
  FilterField,
  FilterFieldArgExpression,
  FilterPath,
} from "@fn-sphere/core";
import type { FilterSchemaContext } from "../hooks/use-filter-schema-context.js";
import type {
  $ZodArray,
  $ZodEnum,
  $ZodLiteral,
  $ZodTuple,
  $ZodType,
  $ZodTypes,
  $ZodUnion,
} from "zod/v4/core";
import { useRootRule } from "../hooks/use-root-rule.js";
import { useView } from "../theme/hooks.js";
import type { DataInputViewSpec } from "../theme/types.js";

type InputMode = "value" | "field" | "expression";
type OperandKind = "literal" | "field";

const getOnlyParameter = (schema: $ZodTuple) => schema._zod.def.items[0];

const getTypeName = (schema: $ZodType) => (schema as $ZodTypes)._zod.def.type;

const numberSchema = z.number();
const dateSchema = z.date();
const isSameParameterType = (a: $ZodType, b: $ZodType) =>
  getTypeName(a) === "any" || getTypeName(b) === "any" || isSameType(a, b);

const getExpressionMode = (arg: unknown): InputMode => {
  if (!isFilterArgExpression(arg)) {
    return "value";
  }
  if (arg.type === "field") {
    return "field";
  }
  return "expression";
};

const getLiteralValue = (arg: unknown) => {
  if (isFilterArgExpression(arg) && arg.type === "literal") {
    return arg.value;
  }
  return arg;
};

const getFieldArg = (arg: unknown): FilterFieldArgExpression | undefined =>
  isFilterArgExpression(arg) && arg.type === "field" ? arg : undefined;

const toFieldArg = (path: FilterPath): FilterFieldArgExpression => ({
  type: "field",
  path,
});

const toLiteralArg = (value: unknown): FilterArgExpression => ({
  type: "literal",
  value,
});

const toNumberOperandArg = (
  arg: unknown,
  fallback: FilterArgExpression,
): FilterArgExpression => {
  if (
    isFilterArgExpression(arg) &&
    (arg.type === "field" || arg.type === "literal")
  ) {
    return arg;
  }
  if (typeof arg === "number") {
    return toLiteralArg(arg);
  }
  return fallback;
};

const toDateBaseArg = (
  arg: unknown,
  fallback: FilterArgExpression,
): FilterArgExpression => {
  if (
    isFilterArgExpression(arg) &&
    (arg.type === "field" || arg.type === "literal")
  ) {
    return arg;
  }
  if (arg instanceof Date) {
    return toLiteralArg(arg);
  }
  return fallback;
};

const getNumberValue = (arg: unknown, fallback: number) =>
  typeof arg === "number" ? arg : fallback;

const getFieldOptions = ({
  fields,
  parameterSchema,
  currentPath,
  getLocaleText,
  mapFieldName,
}: {
  fields: FilterField[];
  parameterSchema: $ZodType;
  currentPath?: FilterPath | undefined;
  getLocaleText: (key: string) => string;
  mapFieldName: (field: FilterField) => string;
}) =>
  fields
    .filter((field) => {
      if (currentPath && isEqualPath(field.path, currentPath)) {
        return false;
      }
      return isSameParameterType(parameterSchema, field.fieldSchema);
    })
    .map((field) => ({
      label: getLocaleText(mapFieldName(field)),
      value: field,
    }));

const createDefaultFieldArg = (
  fieldOptions: { value: FilterField }[],
): FilterFieldArgExpression | undefined => {
  const field = fieldOptions[0]?.value;
  if (!field) return;
  return toFieldArg(field.path);
};

const isNumberExpression = (arg: unknown): arg is FilterBinaryArgExpression =>
  isFilterArgExpression(arg) && arg.type === "binary";

const isDateOffsetExpression = (
  arg: unknown,
): arg is FilterDateOffsetArgExpression =>
  isFilterArgExpression(arg) && arg.type === "dateOffset";

const getOperandKind = (arg: FilterArgExpression): OperandKind =>
  arg.type === "field" ? "field" : "literal";

const getAvailableOperandKind = (
  kind: OperandKind,
  fieldOptions: { value: FilterField; label: string }[],
): OperandKind => (kind === "field" && !fieldOptions.length ? "literal" : kind);

const getAvailableInputMode = (
  mode: InputMode,
  fieldOptions: { value: FilterField; label: string }[],
  showExpression: boolean,
): InputMode => {
  if (mode === "field" && !fieldOptions.length) {
    return "value";
  }
  if (mode === "expression" && (!showExpression || !fieldOptions.length)) {
    return "value";
  }
  return mode;
};

const getOperandLiteralNumber = (arg: FilterArgExpression) =>
  arg.type === "literal" && typeof arg.value === "number" ? arg.value : 0;

const getOperandField = (arg: FilterArgExpression) =>
  arg.type === "field" ? arg : undefined;

const createDefaultNumberExpression = (
  fieldOptions: { value: FilterField }[],
): FilterBinaryArgExpression => ({
  type: "binary",
  op: "multiply",
  left: toLiteralArg(10),
  right: createDefaultFieldArg(fieldOptions) ?? toLiteralArg(1),
});

const createDefaultDateOffsetExpression = (
  fieldOptions: { value: FilterField }[],
): FilterDateOffsetArgExpression => ({
  type: "dateOffset",
  base: createDefaultFieldArg(fieldOptions) ?? toLiteralArg(new Date()),
  op: "add",
  duration: {
    years: toLiteralArg(0),
    months: toLiteralArg(0),
    days: toLiteralArg(10),
  },
});

const getDateOffsetDuration = (
  expression: FilterDateOffsetArgExpression,
): FilterDateOffsetDuration => {
  const duration = "duration" in expression ? expression.duration : undefined;
  if (duration) {
    return duration;
  }
  return {
    years: toLiteralArg(0),
    months: toLiteralArg(0),
    days: expression.amount ?? toLiteralArg(0),
  };
};

const setDateOffsetDuration = (
  expression: FilterDateOffsetArgExpression,
  duration: FilterDateOffsetDuration,
): FilterDateOffsetArgExpression => ({
  type: "dateOffset",
  base: expression.base,
  op: expression.op,
  duration,
});

const FieldArgumentSelect = ({
  value,
  options,
  onChange,
}: {
  value?: FilterFieldArgExpression | undefined;
  options: { value: FilterField; label: string }[];
  onChange: (value: FilterFieldArgExpression) => void;
}) => {
  const { Select } = useView("components");
  const selectedField = value
    ? options.find((option) => isEqualPath(option.value.path, value.path))
        ?.value
    : undefined;
  return (
    <Select
      options={options}
      value={selectedField}
      onChange={(field) => onChange(toFieldArg(field.path))}
    />
  );
};

const NumberOperandInput = ({
  value,
  fieldOptions,
  onChange,
}: {
  value: FilterArgExpression;
  fieldOptions: { value: FilterField; label: string }[];
  onChange: (value: FilterArgExpression) => void;
}) => {
  const { Input: InputView, Select } = useView("components");
  const { getLocaleText } = useRootRule();
  const kind = getAvailableOperandKind(getOperandKind(value), fieldOptions);
  const options: { label: string; value: OperandKind }[] = [
    { label: getLocaleText("argumentModeValue"), value: "literal" },
  ];
  if (fieldOptions.length) {
    options.push({ label: getLocaleText("argumentModeField"), value: "field" });
  }
  return (
    <>
      <Select
        options={options}
        value={kind}
        onChange={(newKind) => {
          if (newKind === "field") {
            const firstField = createDefaultFieldArg(fieldOptions);
            if (firstField) onChange(firstField);
            return;
          }
          onChange(toLiteralArg(getOperandLiteralNumber(value)));
        }}
      />
      {kind === "field" ? (
        <FieldArgumentSelect
          value={getOperandField(value)}
          options={fieldOptions}
          onChange={onChange}
        />
      ) : (
        <InputView
          type="number"
          value={String(getOperandLiteralNumber(value))}
          onChange={(newValue) => {
            onChange(toLiteralArg(newValue.length ? +newValue : 0));
          }}
        />
      )}
    </>
  );
};

const NumberExpressionInput = ({
  value,
  fieldOptions,
  onChange,
}: {
  value: FilterBinaryArgExpression;
  fieldOptions: { value: FilterField; label: string }[];
  onChange: (value: FilterBinaryArgExpression) => void;
}) => {
  const { Select } = useView("components");
  const { getLocaleText } = useRootRule();
  return (
    <>
      <NumberOperandInput
        value={value.left}
        fieldOptions={fieldOptions}
        onChange={(left) => onChange({ ...value, left })}
      />
      <Select
        options={[
          {
            label: getLocaleText("argumentOperatorAdd"),
            value: "add" as const,
          },
          {
            label: getLocaleText("argumentOperatorSubtract"),
            value: "subtract" as const,
          },
          {
            label: getLocaleText("argumentOperatorMultiply"),
            value: "multiply" as const,
          },
          {
            label: getLocaleText("argumentOperatorDivide"),
            value: "divide" as const,
          },
        ]}
        value={value.op}
        onChange={(op) => onChange({ ...value, op })}
      />
      <NumberOperandInput
        value={value.right}
        fieldOptions={fieldOptions}
        onChange={(right) => onChange({ ...value, right })}
      />
    </>
  );
};

const DateBaseInput = ({
  value,
  fieldOptions,
  onChange,
}: {
  value: FilterArgExpression;
  fieldOptions: { value: FilterField; label: string }[];
  onChange: (value: FilterArgExpression) => void;
}) => {
  const { Input: InputView, Select } = useView("components");
  const { getLocaleText } = useRootRule();
  const kind = getAvailableOperandKind(getOperandKind(value), fieldOptions);
  const options: { label: string; value: OperandKind }[] = [
    { label: getLocaleText("argumentModeValue"), value: "literal" },
  ];
  if (fieldOptions.length) {
    options.push({ label: getLocaleText("argumentModeField"), value: "field" });
  }
  const literalValue =
    value.type === "literal" && value.value instanceof Date
      ? value.value.toISOString().slice(0, 10)
      : "";
  return (
    <>
      <Select
        options={options}
        value={kind}
        onChange={(newKind) => {
          if (newKind === "field") {
            const firstField = createDefaultFieldArg(fieldOptions);
            if (firstField) onChange(firstField);
            return;
          }
          onChange(toLiteralArg(new Date()));
        }}
      />
      {kind === "field" ? (
        <FieldArgumentSelect
          value={getOperandField(value)}
          options={fieldOptions}
          onChange={onChange}
        />
      ) : (
        <InputView
          type="date"
          value={literalValue}
          onChange={(newValue) => {
            onChange(toLiteralArg(newValue ? new Date(newValue) : new Date()));
          }}
        />
      )}
    </>
  );
};

const DateOffsetExpressionInput = ({
  value,
  dateFieldOptions,
  numberFieldOptions,
  onChange,
}: {
  value: FilterDateOffsetArgExpression;
  dateFieldOptions: { value: FilterField; label: string }[];
  numberFieldOptions: { value: FilterField; label: string }[];
  onChange: (value: FilterDateOffsetArgExpression) => void;
}) => {
  const { Select } = useView("components");
  const { getLocaleText } = useRootRule();
  const duration = getDateOffsetDuration(value);
  const updateDuration = (
    key: keyof FilterDateOffsetDuration,
    newValue: FilterArgExpression,
  ) => onChange(setDateOffsetDuration(value, { ...duration, [key]: newValue }));
  return (
    <>
      <DateBaseInput
        value={value.base}
        fieldOptions={dateFieldOptions}
        onChange={(base) => onChange({ ...value, base })}
      />
      <Select
        options={[
          {
            label: getLocaleText("argumentOperatorAdd"),
            value: "add" as const,
          },
          {
            label: getLocaleText("argumentOperatorSubtract"),
            value: "subtract" as const,
          },
        ]}
        value={value.op}
        onChange={(op) =>
          onChange(setDateOffsetDuration({ ...value, op }, duration))
        }
      />
      <NumberOperandInput
        value={duration.years ?? toLiteralArg(0)}
        fieldOptions={numberFieldOptions}
        onChange={(newValue) => updateDuration("years", newValue)}
      />
      <span>{getLocaleText("argumentUnitYear")}</span>
      <NumberOperandInput
        value={duration.months ?? toLiteralArg(0)}
        fieldOptions={numberFieldOptions}
        onChange={(newValue) => updateDuration("months", newValue)}
      />
      <span>{getLocaleText("argumentUnitMonth")}</span>
      <NumberOperandInput
        value={duration.days ?? toLiteralArg(0)}
        fieldOptions={numberFieldOptions}
        onChange={(newValue) => updateDuration("days", newValue)}
      />
      <span>{getLocaleText("argumentUnitDay")}</span>
    </>
  );
};

const SingleArgInputMode = ({
  mode,
  showExpression,
  showField,
  onChangeMode,
}: {
  mode: InputMode;
  showExpression: boolean;
  showField: boolean;
  onChangeMode: (mode: InputMode) => void;
}) => {
  const { Select } = useView("components");
  const { getLocaleText } = useRootRule();
  const options: { label: string; value: InputMode }[] = [
    { label: getLocaleText("argumentModeValue"), value: "value" as const },
  ];
  if (showField) {
    options.push({
      label: getLocaleText("argumentModeField"),
      value: "field",
    });
  }
  if (showExpression) {
    options.push({
      label: getLocaleText("argumentModeExpression"),
      value: "expression",
    });
  }
  return <Select options={options} value={mode} onChange={onChangeMode} />;
};

const SingleArgShell = ({
  children,
  mode,
  fieldOptions,
  fieldValue,
  onChangeMode,
  onChangeField,
  showExpression = false,
}: {
  children: ReactNode;
  mode: InputMode;
  fieldOptions: { value: FilterField; label: string }[];
  fieldValue?: FilterFieldArgExpression | undefined;
  onChangeMode: (mode: InputMode) => void;
  onChangeField: (value: FilterFieldArgExpression) => void;
  showExpression?: boolean;
}) => {
  const canShowExpression = showExpression && fieldOptions.length > 0;
  const availableMode = getAvailableInputMode(
    mode,
    fieldOptions,
    canShowExpression,
  );
  return (
    <>
      <SingleArgInputMode
        mode={availableMode}
        showExpression={canShowExpression}
        showField={fieldOptions.length > 0}
        onChangeMode={onChangeMode}
      />
      {availableMode === "field" ? (
        <FieldArgumentSelect
          value={fieldValue}
          options={fieldOptions}
          onChange={onChangeField}
        />
      ) : (
        children
      )}
    </>
  );
};

const createFieldArgumentOptions = ({
  context,
  parameterSchema,
  currentPath,
}: {
  context: FilterSchemaContext;
  parameterSchema: $ZodType;
  currentPath?: FilterPath | undefined;
}) =>
  getFieldOptions({
    fields: context.filterableFields,
    parameterSchema,
    currentPath,
    getLocaleText: context.getLocaleText,
    mapFieldName: context.mapFieldName,
  });

const hasParameterSchemas = (
  parameterSchemas: $ZodTuple,
  expectedSchemas: $ZodType[],
) => {
  const items = parameterSchemas._zod.def.items;
  return (
    items.length === expectedSchemas.length &&
    items.every((item, index) => {
      const expectedSchema = expectedSchemas[index];
      return (
        !!expectedSchema &&
        isSameParameterType(item as $ZodType, expectedSchema)
      );
    })
  );
};

const NumberRangeInput = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) => {
  const { Input: InputView } = useView("components");
  return (
    <InputView
      type="number"
      value={String(value)}
      onChange={(newValue) => {
        onChange(newValue.length ? +newValue : 0);
      }}
    />
  );
};

export const presetDataInputSpecs: DataInputViewSpec[] = [
  {
    // Use when user selects a field with no input
    name: "no need input",
    match: [],
    view: function View() {
      return null;
    },
  },
  {
    name: "boolean",
    match: [z.boolean()],
    view: function View({ context, requiredDataSchema, rule, updateInput }) {
      const { getLocaleText } = useRootRule();
      const { Select } = useView("components");
      const parameterSchema = getOnlyParameter(requiredDataSchema);
      const fieldOptions = createFieldArgumentOptions({
        context,
        parameterSchema: parameterSchema as $ZodType,
        currentPath: rule.path,
      });
      const mode = getExpressionMode(rule.args[0]);
      const options = [
        { label: getLocaleText("valueTrue"), value: true },
        { label: getLocaleText("valueFalse"), value: false },
      ];
      return (
        <SingleArgShell
          mode={mode === "expression" ? "value" : mode}
          fieldOptions={fieldOptions}
          fieldValue={getFieldArg(rule.args[0])}
          onChangeMode={(newMode) => {
            if (newMode === "field") {
              const fieldArg = createDefaultFieldArg(fieldOptions);
              if (fieldArg) updateInput(fieldArg);
              return;
            }
            updateInput(false);
          }}
          onChangeField={(value) => updateInput(value)}
        >
          <Select
            options={options}
            value={(getLiteralValue(rule.args[0]) as boolean) ?? false}
            onChange={(value) => {
              updateInput(value);
            }}
          />
        </SingleArgShell>
      );
    },
  },
  {
    name: "string",
    match: [z.string()],
    view: function View({ context, requiredDataSchema, rule, updateInput }) {
      const { Input: InputView } = useView("components");
      if (!requiredDataSchema._zod.def.items.length) {
        return null;
      }
      const parameterSchema = getOnlyParameter(requiredDataSchema);
      const fieldOptions = createFieldArgumentOptions({
        context,
        parameterSchema: parameterSchema as $ZodType,
        currentPath: rule.path,
      });
      const mode = getExpressionMode(rule.args[0]);
      const value = (getLiteralValue(rule.args[0]) as string | undefined) ?? "";
      return (
        <SingleArgShell
          mode={mode === "expression" ? "value" : mode}
          fieldOptions={fieldOptions}
          fieldValue={getFieldArg(rule.args[0])}
          onChangeMode={(newMode) => {
            if (newMode === "field") {
              const fieldArg = createDefaultFieldArg(fieldOptions);
              if (fieldArg) updateInput(fieldArg);
              return;
            }
            updateInput(value);
          }}
          onChangeField={(newValue) => updateInput(newValue)}
        >
          <InputView
            type="text"
            value={value}
            onChange={(newValue) => {
              if (!newValue.length) {
                updateInput();
                return;
              }
              updateInput(newValue);
              return;
            }}
          />
        </SingleArgShell>
      );
    },
  },
  {
    name: "number tuple",
    match: (parameterSchemas, fieldSchema) => {
      if (!fieldSchema || !isSameParameterType(fieldSchema, numberSchema)) {
        return false;
      }
      return hasParameterSchemas(parameterSchemas, [
        numberSchema,
        numberSchema,
      ]);
    },
    view: function View({ context, requiredDataSchema, rule, updateInput }) {
      const { getLocaleText } = useRootRule();
      const otherNumberSchema = requiredDataSchema._zod.def.items[0];
      const fieldOptions = createFieldArgumentOptions({
        context,
        parameterSchema: otherNumberSchema as $ZodType,
        currentPath: rule.path,
      });
      const fallbackOther =
        createDefaultFieldArg(fieldOptions) ?? toLiteralArg(0);
      const otherNumber = toNumberOperandArg(rule.args[0], fallbackOther);
      const threshold = getNumberValue(rule.args[1], 10);

      useEffect(() => {
        if (rule.args.length !== 2) {
          updateInput(otherNumber, threshold);
        }
      }, [otherNumber, rule.args.length, threshold, updateInput]);

      return (
        <>
          <span>{getLocaleText("argumentOtherNumber")}</span>
          <NumberOperandInput
            value={otherNumber}
            fieldOptions={fieldOptions}
            onChange={(newOtherNumber) =>
              updateInput(newOtherNumber, threshold)
            }
          />
          <span>{getLocaleText("argumentThreshold")}</span>
          <NumberRangeInput
            value={threshold}
            onChange={(newThreshold) => updateInput(otherNumber, newThreshold)}
          />
        </>
      );
    },
  },
  {
    name: "date range tuple",
    match: (parameterSchemas, fieldSchema) => {
      if (!fieldSchema || !isSameParameterType(fieldSchema, dateSchema)) {
        return false;
      }
      return hasParameterSchemas(parameterSchemas, [
        dateSchema,
        numberSchema,
        numberSchema,
      ]);
    },
    view: function View({ context, requiredDataSchema, rule, updateInput }) {
      const { getLocaleText } = useRootRule();
      const baseDateSchema = requiredDataSchema._zod.def.items[0];
      const dateFieldOptions = createFieldArgumentOptions({
        context,
        parameterSchema: baseDateSchema as $ZodType,
        currentPath: rule.path,
      });
      const baseDate = toDateBaseArg(
        rule.args[0],
        createDefaultFieldArg(dateFieldOptions) ?? toLiteralArg(new Date()),
      );
      const minDays = getNumberValue(rule.args[1], 0);
      const maxDays = getNumberValue(rule.args[2], 14);

      useEffect(() => {
        if (rule.args.length !== 3) {
          updateInput(baseDate, minDays, maxDays);
        }
      }, [baseDate, maxDays, minDays, rule.args.length, updateInput]);

      return (
        <>
          <span>{getLocaleText("argumentBaseDate")}</span>
          <DateBaseInput
            value={baseDate}
            fieldOptions={dateFieldOptions}
            onChange={(newBaseDate) =>
              updateInput(newBaseDate, minDays, maxDays)
            }
          />
          <span>{getLocaleText("argumentMinDays")}</span>
          <NumberRangeInput
            value={minDays}
            onChange={(newMinDays) =>
              updateInput(baseDate, newMinDays, maxDays)
            }
          />
          <span>{getLocaleText("argumentMaxDays")}</span>
          <NumberRangeInput
            value={maxDays}
            onChange={(newMaxDays) =>
              updateInput(baseDate, minDays, newMaxDays)
            }
          />
        </>
      );
    },
  },
  {
    name: "number",
    match: [z.number()],
    view: function View({ context, requiredDataSchema, rule, updateInput }) {
      const { Input: InputView } = useView("components");
      if (!requiredDataSchema._zod.def.items.length) {
        return null;
      }
      const parameterSchema = getOnlyParameter(requiredDataSchema);
      const fieldOptions = createFieldArgumentOptions({
        context,
        parameterSchema: parameterSchema as $ZodType,
        currentPath: rule.path,
      });
      const expression = isNumberExpression(rule.args[0])
        ? rule.args[0]
        : createDefaultNumberExpression(fieldOptions);
      const literalValue = getLiteralValue(rule.args[0]);
      const value = typeof literalValue === "number" ? literalValue : "";
      const canShowExpression = fieldOptions.length > 0;
      const mode = getAvailableInputMode(
        getExpressionMode(rule.args[0]),
        fieldOptions,
        canShowExpression,
      );
      return (
        <SingleArgShell
          mode={mode}
          showExpression={canShowExpression}
          fieldOptions={fieldOptions}
          fieldValue={getFieldArg(rule.args[0])}
          onChangeMode={(newMode) => {
            if (newMode === "field") {
              const fieldArg = createDefaultFieldArg(fieldOptions);
              if (fieldArg) updateInput(fieldArg);
              return;
            }
            if (newMode === "expression") {
              updateInput(expression);
              return;
            }
            updateInput(typeof value === "number" ? value : undefined);
          }}
          onChangeField={(newValue) => updateInput(newValue)}
        >
          {mode === "expression" ? (
            <NumberExpressionInput
              value={expression}
              fieldOptions={fieldOptions}
              onChange={(newValue) => updateInput(newValue)}
            />
          ) : (
            <InputView
              type="number"
              value={value}
              onChange={(newValue) => {
                if (!newValue.length) {
                  updateInput();
                  return;
                }
                updateInput(+newValue);
                return;
              }}
            />
          )}
        </SingleArgShell>
      );
    },
  },
  {
    name: "date",
    match: [z.date()],
    view: function View({ context, requiredDataSchema, rule, updateInput }) {
      const { Input: InputView } = useView("components");
      if (!requiredDataSchema._zod.def.items.length) {
        return null;
      }
      const parameterSchema = getOnlyParameter(requiredDataSchema);
      const dateFieldOptions = createFieldArgumentOptions({
        context,
        parameterSchema: parameterSchema as $ZodType,
        currentPath: rule.path,
      });
      const numberFieldOptions = createFieldArgumentOptions({
        context,
        parameterSchema: numberSchema,
        currentPath: rule.path,
      });
      const expression = isDateOffsetExpression(rule.args[0])
        ? rule.args[0]
        : createDefaultDateOffsetExpression(dateFieldOptions);
      const canShowExpression = dateFieldOptions.length > 0;
      const mode = getAvailableInputMode(
        getExpressionMode(rule.args[0]),
        dateFieldOptions,
        canShowExpression,
      );

      const literalDate = getLiteralValue(rule.args[0]);
      const value =
        literalDate instanceof Date
          ? literalDate.toISOString().slice(0, 10)
          : "";

      return (
        <SingleArgShell
          mode={mode}
          showExpression
          fieldOptions={dateFieldOptions}
          fieldValue={getFieldArg(rule.args[0])}
          onChangeMode={(newMode) => {
            if (newMode === "field") {
              const fieldArg = createDefaultFieldArg(dateFieldOptions);
              if (fieldArg) updateInput(fieldArg);
              return;
            }
            if (newMode === "expression") {
              updateInput(expression);
              return;
            }
            updateInput(value ? new Date(value) : undefined);
          }}
          onChangeField={(newValue) => updateInput(newValue)}
        >
          {mode === "expression" ? (
            <DateOffsetExpressionInput
              value={expression}
              dateFieldOptions={dateFieldOptions}
              numberFieldOptions={numberFieldOptions}
              onChange={(newValue) => updateInput(newValue)}
            />
          ) : (
            <InputView
              type="date"
              // "yyyy-MM-dd"
              value={value}
              onChange={(newValue) => {
                if (!newValue) {
                  updateInput();
                  return;
                }
                updateInput(new Date(newValue));
              }}
            />
          )}
        </SingleArgShell>
      );
    },
  },
  {
    name: "literal union",
    match: (parameterSchemas) => {
      if (parameterSchemas._zod.def.items.length !== 1) {
        return false;
      }
      const theOnlyItem = parameterSchemas._zod.def.items.at(0);
      const schemaDef = (theOnlyItem as $ZodTypes)._zod.def;
      const isUnion = schemaDef.type === "union";
      if (!isUnion) {
        return false;
      }
      return schemaDef.options.every(
        (option) => option._zod.def.type === "literal",
      );
    },
    view: function View({ context, requiredDataSchema, rule, updateInput }) {
      const { Select } = useView("components");
      const { getLocaleText } = useRootRule();
      const parameterSchema = getOnlyParameter(requiredDataSchema);
      const fieldOptions = createFieldArgumentOptions({
        context,
        parameterSchema: parameterSchema as $ZodType,
        currentPath: rule.path,
      });
      const mode = getExpressionMode(rule.args[0]);

      const options = useMemo(() => {
        const unionSchema = requiredDataSchema._zod.def.items[0] as $ZodUnion<
          $ZodLiteral[]
        >;
        return unionSchema._zod.def.options.map((item) => {
          const value = item._zod.def.values[0];
          const meta = z.globalRegistry.get(item);
          const metaDesc =
            meta && meta.description ? meta.description : undefined;
          return {
            label: getLocaleText(metaDesc ?? String(value)),
            value,
          };
        });
      }, [getLocaleText, requiredDataSchema]);
      return (
        <SingleArgShell
          mode={mode === "expression" ? "value" : mode}
          fieldOptions={fieldOptions}
          fieldValue={getFieldArg(rule.args[0])}
          onChangeMode={(newMode) => {
            if (newMode === "field") {
              const fieldArg = createDefaultFieldArg(fieldOptions);
              if (fieldArg) updateInput(fieldArg);
              return;
            }
            updateInput(getLiteralValue(rule.args[0]));
          }}
          onChangeField={(value) => updateInput(value)}
        >
          <Select
            options={options}
            value={getLiteralValue(rule.args[0])}
            onChange={(value) => {
              updateInput(value);
            }}
          />
        </SingleArgShell>
      );
    },
  },
  {
    name: "literal array",
    match: (parameterSchemas) => {
      if (parameterSchemas._zod.def.items.length !== 1) {
        return false;
      }
      const theOnlyItem = parameterSchemas._zod.def.items.at(0);
      const schemaDef = (theOnlyItem as $ZodTypes)._zod.def;
      return (
        schemaDef.type === "array" &&
        schemaDef.element._zod.def.type === "union" &&
        (schemaDef.element as $ZodUnion)._zod.def.options.every(
          (op) => op._zod.def.type === "literal",
        )
      );
    },
    view: function View({ context, requiredDataSchema, rule, updateInput }) {
      const { MultipleSelect: MultipleSelectView } = useView("components");
      const { getLocaleText } = useRootRule();
      const parameterSchema = getOnlyParameter(requiredDataSchema);
      const fieldOptions = createFieldArgumentOptions({
        context,
        parameterSchema: parameterSchema as $ZodType,
        currentPath: rule.path,
      });
      const mode = getExpressionMode(rule.args[0]);
      const arraySchema = requiredDataSchema._zod.def.items[0] as $ZodArray<
        $ZodUnion<$ZodLiteral[]>
      >;
      const unionSchema = arraySchema._zod.def.element;
      const options = unionSchema._zod.def.options.map((item) => {
        const value = item._zod.def.values[0];
        const meta = z.globalRegistry.get(item);
        const metaDesc =
          meta && meta.description ? meta.description : undefined;
        return {
          label: getLocaleText(metaDesc ?? String(value)),
          value,
        };
      });
      const value = (getLiteralValue(rule.args[0]) ??
        []) as z.core.util.Literal[];
      return (
        <SingleArgShell
          mode={mode === "expression" ? "value" : mode}
          fieldOptions={fieldOptions}
          fieldValue={getFieldArg(rule.args[0])}
          onChangeMode={(newMode) => {
            if (newMode === "field") {
              const fieldArg = createDefaultFieldArg(fieldOptions);
              if (fieldArg) updateInput(fieldArg);
              return;
            }
            updateInput(value);
          }}
          onChangeField={(newValue) => updateInput(newValue)}
        >
          <MultipleSelectView
            value={value}
            options={options}
            onChange={(newValue) => {
              if (!newValue.length) {
                updateInput();
                return;
              }
              updateInput(newValue);
            }}
          />
        </SingleArgShell>
      );
    },
  },
  {
    name: "enum",
    match: (parameterSchemas) => {
      if (parameterSchemas._zod.def.items.length !== 1) {
        return false;
      }
      const theOnlyItem = parameterSchemas._zod.def.items.at(0);
      const schemaDef = (theOnlyItem as $ZodTypes)._zod.def;
      return schemaDef.type === "enum";
    },
    view: function View({ context, requiredDataSchema, rule, updateInput }) {
      const { Select } = useView("components");
      const { getLocaleText } = useRootRule();
      const parameterSchema = getOnlyParameter(requiredDataSchema);
      const fieldOptions = createFieldArgumentOptions({
        context,
        parameterSchema: parameterSchema as $ZodType,
        currentPath: rule.path,
      });
      const mode = getExpressionMode(rule.args[0]);

      const options = useMemo(() => {
        const enumSchema = requiredDataSchema._zod.def.items[0] as $ZodEnum;
        return Object.entries(enumSchema._zod.def.entries).map(
          ([key, value]) => {
            return {
              label: getLocaleText(key),
              value,
            };
          },
        );
      }, [getLocaleText, requiredDataSchema]);

      return (
        <SingleArgShell
          mode={mode === "expression" ? "value" : mode}
          fieldOptions={fieldOptions}
          fieldValue={getFieldArg(rule.args[0])}
          onChangeMode={(newMode) => {
            if (newMode === "field") {
              const fieldArg = createDefaultFieldArg(fieldOptions);
              if (fieldArg) updateInput(fieldArg);
              return;
            }
            updateInput(getLiteralValue(rule.args[0]));
          }}
          onChangeField={(newValue) => updateInput(newValue)}
        >
          <Select
            options={options}
            value={getLiteralValue(rule.args[0])}
            onChange={(value) => {
              updateInput(value);
            }}
          />
        </SingleArgShell>
      );
    },
  },
  {
    name: "enum array",
    match: (parameterSchemas) => {
      if (parameterSchemas._zod.def.items.length !== 1) {
        return false;
      }
      const theOnlyItem = parameterSchemas._zod.def.items.at(0);
      const schemaDef = (theOnlyItem as $ZodTypes)._zod.def;
      return (
        schemaDef.type === "array" && schemaDef.element._zod.def.type === "enum"
      );
    },
    view: function View({ context, requiredDataSchema, rule, updateInput }) {
      const { MultipleSelect: MultipleSelectView } = useView("components");
      const { getLocaleText } = useRootRule();
      const parameterSchema = getOnlyParameter(requiredDataSchema);
      const fieldOptions = createFieldArgumentOptions({
        context,
        parameterSchema: parameterSchema as $ZodType,
        currentPath: rule.path,
      });
      const mode = getExpressionMode(rule.args[0]);

      const arraySchema = requiredDataSchema._zod.def
        .items[0] as $ZodArray<$ZodEnum>;
      const enumSchema = arraySchema._zod.def.element as $ZodEnum;

      const options = Object.entries(enumSchema._zod.def.entries).map(
        ([key, value]) => {
          return {
            label: getLocaleText(key),
            value,
          };
        },
      );

      const value = (getLiteralValue(rule.args[0]) ?? []) as string[];

      return (
        <SingleArgShell
          mode={mode === "expression" ? "value" : mode}
          fieldOptions={fieldOptions}
          fieldValue={getFieldArg(rule.args[0])}
          onChangeMode={(newMode) => {
            if (newMode === "field") {
              const fieldArg = createDefaultFieldArg(fieldOptions);
              if (fieldArg) updateInput(fieldArg);
              return;
            }
            updateInput(value);
          }}
          onChangeField={(newValue) => updateInput(newValue)}
        >
          <MultipleSelectView
            value={value}
            options={options}
            onChange={(newValue) => {
              if (!newValue.length) {
                updateInput();
                return;
              }
              updateInput(newValue);
            }}
          />
        </SingleArgShell>
      );
    },
  },
] satisfies DataInputViewSpec[];
