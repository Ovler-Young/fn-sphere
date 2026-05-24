import {
  createFilterGroup,
  createSingleFilter,
  defineTypedFn,
  type FilterGroup,
} from "@fn-sphere/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { FilterSphereProvider, useFilterSphere } from "../index.js";
import { FilterSelect } from "../views/filter-select.js";

afterEach(cleanup);

const lessThanSelectedField = defineTypedFn({
  name: "lessThanSelectedField",
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
        name: lessThanSelectedField.name,
      }),
    ],
  });

function TestFilterSelect({ schema }: { schema: z.ZodObject }) {
  const { filterRule, context } = useFilterSphere({
    schema,
    filterFnList: [lessThanSelectedField],
    defaultRule,
  });
  const rule = filterRule.conditions[0];
  if (!rule || rule.type !== "Filter") {
    throw new Error("Missing test filter rule");
  }

  return (
    <FilterSphereProvider context={context}>
      <FilterSelect rule={rule} aria-label="filter" />
    </FilterSphereProvider>
  );
}

describe("FilterSelect field args", () => {
  it("hides field-arg filters when the selected field has no compatible right field", () => {
    render(
      <TestFilterSelect
        schema={z.object({
          left: z.number(),
          label: z.string(),
        })}
      />,
    );

    expect(screen.getByLabelText("filter").textContent).not.toContain(
      lessThanSelectedField.name,
    );
  });

  it("shows field-arg filters when the selected field has a compatible right field", () => {
    render(
      <TestFilterSelect
        schema={z.object({
          left: z.number(),
          right: z.number(),
        })}
      />,
    );

    expect(screen.getByLabelText("filter").textContent).toContain(
      lessThanSelectedField.name,
    );
  });
});
