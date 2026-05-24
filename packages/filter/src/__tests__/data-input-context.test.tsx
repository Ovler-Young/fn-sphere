import {
  createFilterGroup,
  createSingleFilter,
  defineTypedFn,
  isSameType,
  type FilterField,
  type FilterFieldArgExpression,
  type FilterGroup,
} from "@fn-sphere/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createFilterTheme,
  FilterBuilder,
  FilterSphereProvider,
  useFilterSphere,
  type DataInputViewSpec,
} from "../index.js";

const lessThanSelectedField = defineTypedFn({
  name: "lessThanSelectedField",
  define: z.function({
    input: [z.number(), z.number()],
    output: z.boolean(),
  }),
  implement: (value, target) => value < target,
});

const patientSchema = z.object({
  patientId: z.string().describe("Patient ID"),
  admissionSystolic: z.number().describe("Admission systolic"),
  dischargeSystolic: z.number().describe("Discharge systolic"),
});

const defaultRule = () =>
  createFilterGroup({
    op: "and",
    conditions: [
      createSingleFilter({
        path: ["dischargeSystolic"],
        name: lessThanSelectedField.name,
      }),
    ],
  });

const fieldKey = (field: FilterField) => field.path.join(".");

const fieldArgPath = (arg: unknown) => {
  if (
    arg &&
    typeof arg === "object" &&
    "type" in arg &&
    arg.type === "field" &&
    "path" in arg &&
    Array.isArray(arg.path)
  ) {
    return arg.path.join(".");
  }
  return "";
};

const selectedFieldDataInput: DataInputViewSpec = {
  name: "selected field arg",
  match: ({ selectedFilter }) =>
    selectedFilter?.name === lessThanSelectedField.name,
  view: function SelectedFieldDataInput({
    context,
    fieldSchema,
    rule,
    updateInput,
  }) {
    const compatibleFields = context.filterableFields.filter((field) => {
      if (!fieldSchema) {
        return false;
      }
      return (
        !isSamePath(field.path, rule.path) &&
        isSameType(field.fieldSchema, fieldSchema)
      );
    });

    return (
      <select
        aria-label="right field"
        value={fieldArgPath(rule.args[0])}
        onChange={(event) => {
          const field = compatibleFields.find(
            (option) => fieldKey(option) === event.target.value,
          );
          if (!field) {
            updateInput();
            return;
          }
          const arg: FilterFieldArgExpression = {
            type: "field",
            path: field.path,
          };
          updateInput(arg);
        }}
      >
        <option value=""></option>
        {compatibleFields.map((field) => (
          <option key={fieldKey(field)} value={fieldKey(field)}>
            {context.mapFieldName(field)}
          </option>
        ))}
      </select>
    );
  },
};

const isSamePath = (
  left: readonly (string | number)[],
  right: readonly (string | number)[] | undefined,
) => {
  if (!right || left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
};

const theme = createFilterTheme({
  dataInputViews: [selectedFieldDataInput],
});

function TestFilterBuilder({
  onRuleChange,
}: {
  onRuleChange: (rule: FilterGroup) => void;
}) {
  const { context } = useFilterSphere({
    schema: patientSchema,
    filterFnList: [lessThanSelectedField],
    defaultRule,
    onRuleChange: ({ filterRule }) => {
      onRuleChange(filterRule);
    },
  });

  return (
    <FilterSphereProvider context={context} theme={theme}>
      <FilterBuilder />
    </FilterSphereProvider>
  );
}

describe("custom data input context", () => {
  it("passes selectedFilter and schema context to custom data input views", () => {
    const onRuleChange = vi.fn();

    render(<TestFilterBuilder onRuleChange={onRuleChange} />);

    const rightFieldSelect = screen.getByLabelText("right field");
    expect(rightFieldSelect.textContent).toContain("Admission systolic");
    expect(rightFieldSelect.textContent).not.toContain("Discharge systolic");
    expect(rightFieldSelect.textContent).not.toContain("Patient ID");

    fireEvent.change(rightFieldSelect, {
      target: { value: "admissionSystolic" },
    });

    expect(onRuleChange).toHaveBeenCalledTimes(1);
    const nextRule = onRuleChange.mock.calls[0]?.[0];
    expect(nextRule?.conditions[0]).toMatchObject({
      type: "Filter",
      path: ["dischargeSystolic"],
      name: lessThanSelectedField.name,
      args: [{ type: "field", path: ["admissionSystolic"] }],
    });
  });
});
