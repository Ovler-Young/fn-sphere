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

  it("only lists compatible field reference options", () => {
    const { container } = render(
      <TestFilter
        schema={z.object({
          score: z.number(),
          multiplier: z.number(),
          label: z.string(),
        })}
        onRuleChange={() => {}}
      />,
    );

    const selects = within(container).getAllByRole("combobox");
    fireEvent.change(selects[2]!, { target: { value: "1" } });

    const fieldSelect = within(container).getAllByRole("combobox")[3]!;
    const fieldOptions = within(fieldSelect)
      .getAllByRole("option")
      .map((option) => option.textContent)
      .filter(Boolean);

    expect(fieldOptions).toEqual(["multiplier"]);
    expect(fieldOptions).not.toContain("score");
    expect(fieldOptions).not.toContain("label");
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

  it("writes number difference field and threshold arguments", async () => {
    let latestRule: FilterGroup | undefined;
    const { container } = render(
      <TestFilter
        schema={z.object({ score: z.number(), baseline: z.number() })}
        onRuleChange={(rule) => {
          latestRule = rule;
        }}
      />,
    );

    const selects = within(container).getAllByRole("combobox");
    fireEvent.change(selects[1]!, { target: { value: "6" } });

    await waitFor(() => {
      expect(getFirstFilter(latestRule!).name).toBe(
        "absoluteDifferenceLessThan",
      );
      expect(getFirstFilter(latestRule!).args).toEqual([
        { type: "field", path: ["baseline"] },
        10,
      ]);
    });

    const inputs = within(container).getAllByRole("spinbutton");
    fireEvent.change(inputs[0]!, { target: { value: "7" } });

    await waitFor(() => {
      expect(getFirstFilter(latestRule!).args).toEqual([
        { type: "field", path: ["baseline"] },
        7,
      ]);
    });
  });

  it("writes date range base field and day arguments", async () => {
    let latestRule: FilterGroup | undefined;
    const { container } = render(
      <TestFilter
        schema={z.object({
          admissionDate: z.date(),
          dischargeDate: z.date(),
        })}
        onRuleChange={(rule) => {
          latestRule = rule;
        }}
      />,
    );

    const selects = within(container).getAllByRole("combobox");
    fireEvent.change(selects[1]!, { target: { value: "2" } });

    await waitFor(() => {
      expect(getFirstFilter(latestRule!).name).toBe("betweenDaysBefore");
      expect(getFirstFilter(latestRule!).args).toEqual([
        { type: "field", path: ["dischargeDate"] },
        0,
        14,
      ]);
    });

    const inputs = within(container).getAllByRole("spinbutton");
    fireEvent.change(inputs[0]!, { target: { value: "7" } });
    fireEvent.change(inputs[1]!, { target: { value: "14" } });

    await waitFor(() => {
      expect(getFirstFilter(latestRule!).args).toEqual([
        { type: "field", path: ["dischargeDate"] },
        7,
        14,
      ]);
    });
  });
});
