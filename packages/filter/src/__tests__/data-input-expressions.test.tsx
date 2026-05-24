import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { createFilterGroup, createSingleFilter } from "@fn-sphere/core";
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
  defaultRule,
  onRuleChange,
}: {
  schema: z.ZodTypeAny;
  defaultRule?: FilterGroup;
  onRuleChange: (rule: FilterGroup) => void;
}) => {
  const { context } = useFilterSphere({
    schema,
    ...(defaultRule ? { defaultRule } : {}),
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

const getOptionLabels = (select: HTMLElement) =>
  within(select)
    .getAllByRole("option")
    .map((option) => option.textContent)
    .filter(Boolean);

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
    const fieldOptions = getOptionLabels(fieldSelect);

    expect(fieldOptions).toEqual(["multiplier"]);
    expect(fieldOptions).not.toContain("score");
    expect(fieldOptions).not.toContain("label");
  });

  it("hides single-argument field and expression modes when no compatible field exists", () => {
    const { container } = render(
      <TestFilter
        schema={z.object({ score: z.number(), label: z.string() })}
        onRuleChange={() => {}}
      />,
    );

    const modeSelect = within(container).getAllByRole("combobox")[2]!;
    expect(getOptionLabels(modeSelect)).toEqual(["value"]);
  });

  it("renders value mode when an expression rule no longer has a compatible field", () => {
    const { container } = render(
      <TestFilter
        schema={z.object({ score: z.number(), label: z.string() })}
        defaultRule={createFilterGroup({
          op: "and",
          conditions: [
            createSingleFilter({
              path: ["score"],
              name: "greaterThan",
              args: [
                {
                  type: "binary",
                  op: "multiply",
                  left: { type: "literal", value: 10 },
                  right: { type: "literal", value: 2 },
                },
              ],
            }),
          ],
        })}
        onRuleChange={() => {}}
      />,
    );

    const modeSelect = within(container).getAllByRole("combobox")[2]!;
    expect(getOptionLabels(modeSelect)).toEqual(["value"]);
    expect((modeSelect as HTMLSelectElement).value).toBe("0");
    expect(within(container).getAllByRole("spinbutton")).toHaveLength(1);
  });

  it("hides number operand field mode when no compatible field exists", () => {
    const { container } = render(
      <TestFilter
        schema={z.object({ score: z.number(), label: z.string() })}
        onRuleChange={() => {}}
      />,
    );

    const selects = within(container).getAllByRole("combobox");
    fireEvent.change(selects[1]!, { target: { value: "6" } });

    const operandModeSelect = within(container).getAllByRole("combobox")[2]!;
    expect(getOptionLabels(operandModeSelect)).toEqual(["value"]);
  });

  it("hides date operand field mode when no compatible field exists", () => {
    const { container } = render(
      <TestFilter
        schema={z.object({ admissionDate: z.date(), label: z.string() })}
        onRuleChange={() => {}}
      />,
    );

    const selects = within(container).getAllByRole("combobox");
    fireEvent.change(selects[1]!, { target: { value: "2" } });

    const baseDateModeSelect = within(container).getAllByRole("combobox")[2]!;
    expect(getOptionLabels(baseDateModeSelect)).toEqual(["value"]);
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
