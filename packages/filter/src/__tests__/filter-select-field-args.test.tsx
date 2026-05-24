import {
  createFilterGroup,
  createSingleFilter,
  defineTypedFn,
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

const contextualInputFilter = defineTypedFn({
  name: "contextualInputFilter",
  define: z.function({
    input: [z.number(), z.object({ target: z.number() })],
    output: z.boolean(),
  }),
  implement: (value, target) => value < target.target,
});

function getFirstRule(filterRule: FilterGroup) {
  const rule = filterRule.conditions[0];
  if (!rule || rule.type !== "Filter") {
    throw new Error("Missing test filter rule");
  }
  return rule;
}

function TestFilterSelect() {
  const { filterRule, context } = useFilterSphere({
    schema: z.object({
      left: z.number(),
      label: z.string(),
    }),
    filterFnList: [fieldArgFilter],
    defaultRule,
  });

  return (
    <FilterSphereProvider context={context}>
      <FilterSelect rule={getFirstRule(filterRule)} aria-label="filter" />
    </FilterSphereProvider>
  );
}

function TestFilterDataInput({ theme }: { theme: ReturnType<typeof createFilterTheme> }) {
  const { filterRule, context } = useFilterSphere({
    schema: z.object({
      left: z.number(),
      label: z.string(),
    }),
    filterFnList: [contextualInputFilter],
    defaultRule: () =>
      createFilterGroup({
        op: "and",
        conditions: [
          createSingleFilter({
            path: ["left"],
            name: contextualInputFilter.name,
          }),
        ],
      }),
  });

  return (
    <FilterSphereProvider context={context} theme={theme}>
      <FilterDataInput rule={getFirstRule(filterRule)} />
    </FilterSphereProvider>
  );
}

function TestFieldArgDataInput({ theme }: { theme: ReturnType<typeof createFilterTheme> }) {
  const { filterRule, context } = useFilterSphere({
    schema: z.object({
      left: z.number(),
      label: z.string(),
    }),
    filterFnList: [fieldArgFilter],
    defaultRule,
  });

  return (
    <FilterSphereProvider context={context} theme={theme}>
      <FilterDataInput rule={getFirstRule(filterRule)} />
    </FilterSphereProvider>
  );
}

function FieldSwitcher({
  rule,
}: {
  rule: ReturnType<typeof createSingleFilter>;
}) {
  const { fieldOptions, selectedField, setField } = useFilterSelect(rule);
  const options = fieldOptions.map(({ value }) => value);
  const fieldKey = (field: { path: (string | number)[] }) =>
    field.path.join(".");
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

function TestFieldSwitcher({ onRuleChange }: { onRuleChange: (rule: FilterGroup) => void }) {
  const { filterRule, context } = useFilterSphere({
    schema: z.object({
      left: z.number(),
      right: z.number(),
    }),
    filterFnList: [fieldArgFilter, fallbackNumberFilter],
    defaultRule,
    onRuleChange: ({ filterRule: nextRule }) => {
      onRuleChange(nextRule);
    },
  });
  const rule = getFirstRule(filterRule);

  return (
    <FilterSphereProvider context={context}>
      <FieldSwitcher rule={rule} />
    </FilterSphereProvider>
  );
}

describe("FilterSelect field args", () => {
  it("keeps field-arg filters selectable in the shared filter select", () => {
    render(<TestFilterSelect />);

    expect(screen.getByLabelText("filter").textContent).toContain(
      fieldArgFilter.name,
    );
  });

  it("passes selected filter context to custom data input view matching", () => {
    const match = vi.fn((parameterSchemas, fieldSchema, context) => {
      expect(parameterSchemas._zod.def.items).toHaveLength(1);
      expect(fieldSchema?._zod.def.type).toBe("number");
      return (
        context?.selectedFilter?.name === fieldArgFilter.name &&
        context.context?.filterableFields.length === 2
      );
    });
    const theme = createFilterTheme({
      dataInputViews: [
        {
          name: "field arg match probe",
          match,
          view: function FieldArgInput() {
            return <input aria-label="field arg input" />;
          },
        } satisfies DataInputViewSpec,
      ],
    });

    render(<TestFieldArgDataInput theme={theme} />);

    expect(match).toHaveBeenCalled();
  });

  it("passes selected filter context to custom data input view props", () => {
    const theme = createFilterTheme({
      dataInputViews: [
        {
          name: "context input",
          match: (_parameterSchemas, _fieldSchema, context) =>
            context?.selectedFilter?.name === contextualInputFilter.name,
          view: function ContextInput({ selectedFilter, context }) {
            return (
              <input
                aria-label="context input"
                data-filter={selectedFilter?.name}
                data-field-count={context.filterableFields.length}
              />
            );
          },
        } satisfies DataInputViewSpec,
      ],
    });

    render(<TestFilterDataInput theme={theme} />);

    const input = screen.getByLabelText("context input");
    expect(input.getAttribute("data-filter")).toBe(contextualInputFilter.name);
    expect(Number(input.getAttribute("data-field-count"))).toBeGreaterThan(0);
  });

  it("retains field-arg filters when switching fields through shared selection", () => {
    const onRuleChange = vi.fn();

    render(<TestFieldSwitcher onRuleChange={onRuleChange} />);

    fireEvent.change(screen.getByLabelText("field"), {
      target: { value: "right" },
    });

    expect(onRuleChange).toHaveBeenCalledTimes(1);
    const nextRule = onRuleChange.mock.calls[0]?.[0];
    expect(nextRule?.conditions[0]).toMatchObject({
      type: "Filter",
      path: ["right"],
      name: fieldArgFilter.name,
      args: [],
    });
  });
});
