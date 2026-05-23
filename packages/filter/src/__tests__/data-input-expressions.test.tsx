import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import type { FilterGroup } from "@fn-sphere/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  FilterBuilder,
  FilterSphereProvider,
  useFilterSphere,
} from "../index.js";

const TestFilter = ({
  schema,
  onRuleChange,
}: {
  schema: z.ZodTypeAny;
  onRuleChange: (rule: FilterGroup) => void;
}) => {
  const { context } = useFilterSphere({
    schema,
    onRuleChange: ({ filterRule }) => onRuleChange(filterRule),
  });
  return (
    <FilterSphereProvider context={context}>
      <FilterBuilder />
    </FilterSphereProvider>
  );
};

const getFirstFilter = (rule: FilterGroup) => {
  const first = rule.conditions[0];
  if (!first || first.type !== "Filter") {
    throw new Error("First rule is not a filter");
  }
  return first;
};

describe("preset data input expressions", () => {
  afterEach(() => {
    cleanup();
  });

  it("writes a field reference argument", async () => {
    let latestRule: FilterGroup | undefined;
    const { container } = render(
      <TestFilter
        schema={z.object({ name: z.string(), alias: z.string() })}
        onRuleChange={(rule) => {
          latestRule = rule;
        }}
      />,
    );

    const selects = within(container).getAllByRole("combobox");
    fireEvent.change(selects[2]!, { target: { value: "1" } });

    await waitFor(() => {
      expect(getFirstFilter(latestRule!).args[0]).toEqual({
        type: "field",
        path: ["alias"],
      });
    });
  });

  it("writes a number binary expression argument", async () => {
    let latestRule: FilterGroup | undefined;
    const { container } = render(
      <TestFilter
        schema={z.object({ score: z.number(), multiplier: z.number() })}
        onRuleChange={(rule) => {
          latestRule = rule;
        }}
      />,
    );

    const selects = within(container).getAllByRole("combobox");
    fireEvent.change(selects[2]!, { target: { value: "2" } });

    await waitFor(() => {
      expect(getFirstFilter(latestRule!).args[0]).toEqual({
        type: "binary",
        op: "multiply",
        left: { type: "literal", value: 10 },
        right: { type: "field", path: ["multiplier"] },
      });
    });
  });

  it("writes a date offset expression argument", async () => {
    let latestRule: FilterGroup | undefined;
    const { container } = render(
      <TestFilter
        schema={z.object({
          birthday: z.date(),
          deadline: z.date(),
          offsetDays: z.number(),
        })}
        onRuleChange={(rule) => {
          latestRule = rule;
        }}
      />,
    );

    const selects = within(container).getAllByRole("combobox");
    fireEvent.change(selects[2]!, { target: { value: "2" } });

    await waitFor(() => {
      expect(getFirstFilter(latestRule!).args[0]).toEqual({
        type: "dateOffset",
        base: { type: "field", path: ["deadline"] },
        op: "add",
        duration: {
          years: { type: "literal", value: 0 },
          months: { type: "literal", value: 0 },
          days: { type: "literal", value: 10 },
        },
      });
    });
  });
});
