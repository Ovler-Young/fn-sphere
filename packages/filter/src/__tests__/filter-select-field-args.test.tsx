import {
  createFilterGroup,
  createSingleFilter,
  defineTypedFn,
  type FilterField,
  type FilterGroup,
} from "@fn-sphere/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createFilterTheme,
  FilterSphereProvider,
  useFilterSelect,
  useFilterSphere,
  type DataInputViewSpec,
} from "../index.js";
import { FilterDataInput } from "../views/filter-data-input.js";
import { FilterSelect } from "../views/filter-select.js";

afterEach(cleanup);

const fieldArgFilter = defineTypedFn({
  name: "fieldArgFilter",
  define: z.function({
    input: [z.number(), z.number()],
    output: z.boolean(),
  }),
  implement: (value, target) => value < target,
  meta: {
    fieldArgParameters: [0],
  },
});

const defaultRule = () =>
  createFilterGroup({
    op: "and",
    conditions: [
      createSingleFilter({
        path: ["left"],
        name: fieldArgFilter.name,
      }),
    ],
  });

const fallbackNumberFilter = defineTypedFn({
  name: "fallbackNumberFilter",
  define: z.function({
    input: [z.number()],
    output: z.boolean(),
  }),
  implement: (value) => value > 0,
});

const fallbackStringFilter = defineTypedFn({
  name: "fallbackStringFilter",
  define: z.function({
    input: [z.string()],
    output: z.boolean(),
  }),
  implement: (value) => value.length > 0,
});

const dataInputTheme = createFilterTheme({
  dataInputViews: [
    {
      name: "field arg input",
      match: ({ selectedFilter }) =>
        selectedFilter?.name === fieldArgFilter.name,
      view: function FieldArgInput() {
        return <input aria-label="field arg input" />;
      },
    } satisfies DataInputViewSpec,
  ],
});

function getFirstRule(filterRule: FilterGroup) {
  const rule = filterRule.conditions[0];
  if (!rule || rule.type !== "Filter") {
    throw new Error("Missing test filter rule");
  }
  return rule;
}

function TestFilterSelect({ schema }: { schema: z.ZodObject }) {
  const { filterRule, context } = useFilterSphere({
    schema,
    filterFnList: [fieldArgFilter],
    defaultRule,
  });

  return (
    <FilterSphereProvider context={context}>
      <FilterSelect rule={getFirstRule(filterRule)} aria-label="filter" />
    </FilterSphereProvider>
  );
}

function TestFilterDataInput({ schema }: { schema: z.ZodObject }) {
  const { filterRule, context } = useFilterSphere({
    schema,
    filterFnList: [fieldArgFilter],
    defaultRule,
  });

  return (
    <FilterSphereProvider context={context} theme={dataInputTheme}>
      <FilterDataInput rule={getFirstRule(filterRule)} />
    </FilterSphereProvider>
  );
}

function TestFieldSwitcher({
  onRuleChange,
}: {
  onRuleChange: (rule: FilterGroup) => void;
}) {
  const { filterRule, context } = useFilterSphere({
    schema: z.object({
      left: z.number(),
      right: z.number(),
      label: z.string(),
    }),
    filterFnList: [fieldArgFilter, fallbackNumberFilter, fallbackStringFilter],
    defaultRule,
    onRuleChange: ({ filterRule: nextRule }) => {
      onRuleChange(nextRule);
    },
  });
  const rule = getFirstRule(filterRule);

  function FieldSwitcher() {
    const { fieldOptions, selectedField, setField } = useFilterSelect(rule);
    const options = fieldOptions.map(({ value }) => value);
    const fieldKey = (field: FilterField) => field.path.join(".");
    return (
      <select
        aria-label="field"
        value={selectedField ? fieldKey(selectedField) : ""}
        onChange={(event) => {
          const field = options.find(
            (option) => fieldKey(option) === event.target.value,
          );
          if (field) {
            setField(field);
          }
        }}
      >
        {options.map((field) => (
          <option key={fieldKey(field)} value={fieldKey(field)}>
            {fieldKey(field)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <FilterSphereProvider context={context}>
      <FieldSwitcher />
    </FilterSphereProvider>
  );
}

describe("FilterSelect field args", () => {
  it("hides field-arg filters when the current field has no compatible right field", () => {
    render(
      <TestFilterSelect
        schema={z.object({
          left: z.number(),
          label: z.string(),
        })}
      />,
    );

    expect(screen.getByLabelText("filter").textContent).not.toContain(
      fieldArgFilter.name,
    );
  });

  it("shows field-arg filters when the current field has a compatible right field", () => {
    render(
      <TestFilterSelect
        schema={z.object({
          left: z.number(),
          right: z.number(),
        })}
      />,
    );

    expect(screen.getByLabelText("filter").textContent).toContain(
      fieldArgFilter.name,
    );
  });

  it("does not render data input for unavailable filters", () => {
    render(
      <TestFilterDataInput
        schema={z.object({
          left: z.number(),
          label: z.string(),
        })}
      />,
    );

    expect(screen.queryByLabelText("field arg input")).toBeNull();
  });

  it("falls back when changing to a field where the current filter is unavailable", () => {
    const onRuleChange = vi.fn();

    render(<TestFieldSwitcher onRuleChange={onRuleChange} />);

    fireEvent.change(screen.getByLabelText("field"), {
      target: { value: "label" },
    });

    expect(onRuleChange).toHaveBeenCalledTimes(1);
    const nextRule = onRuleChange.mock.calls[0]?.[0];
    expect(nextRule?.conditions[0]).toMatchObject({
      type: "Filter",
      path: ["label"],
      name: fallbackStringFilter.name,
      args: [],
    });
  });
});
