import {
  createFilterTheme,
  createFilterGroup,
  createSingleFilter,
  defineTypedFn,
  type DataInputViewSpec,
  type FilterArgExpression,
  FilterBuilder,
  FilterSphereProvider,
  type FnSchema,
  presetFilter,
  useFilterSphere,
} from "@fn-sphere/filter";
import { useState } from "react";
import { z } from "zod";
import { Table } from "~/components/table";

const patientSchema = z.object({
  id: z.string().describe("Patient ID"),
  admissionDate: z.date().describe("Admission Date"),
  dischargeDate: z.date().describe("Discharge Date"),
  admissionSystolic: z.number().describe("Admission Systolic BP"),
  dischargeSystolic: z.number().describe("Discharge Systolic BP"),
  admissionWeight: z.number().describe("Admission Weight"),
  dischargeWeight: z.number().describe("Discharge Weight"),
});

type PatientRecord = z.infer<typeof patientSchema>;

const date = (value: string) => new Date(value);

const patientData: PatientRecord[] = [
  {
    id: "P-001",
    admissionDate: date("2026-01-02"),
    dischargeDate: date("2026-01-10"),
    admissionSystolic: 156,
    dischargeSystolic: 138,
    admissionWeight: 76.2,
    dischargeWeight: 74.8,
  },
  {
    id: "P-002",
    admissionDate: date("2026-01-03"),
    dischargeDate: date("2026-01-20"),
    admissionSystolic: 148,
    dischargeSystolic: 134,
    admissionWeight: 68.1,
    dischargeWeight: 65.5,
  },
  {
    id: "P-003",
    admissionDate: date("2026-01-05"),
    dischargeDate: date("2026-01-14"),
    admissionSystolic: 142,
    dischargeSystolic: 146,
    admissionWeight: 82.4,
    dischargeWeight: 80.9,
  },
  {
    id: "P-004",
    admissionDate: date("2026-01-06"),
    dischargeDate: date("2026-01-16"),
    admissionSystolic: 164,
    dischargeSystolic: 141,
    admissionWeight: 90.0,
    dischargeWeight: 86.7,
  },
  {
    id: "P-005",
    admissionDate: date("2026-01-08"),
    dischargeDate: date("2026-01-12"),
    admissionSystolic: 136,
    dischargeSystolic: 125,
    admissionWeight: 71.5,
    dischargeWeight: 72.3,
  },
  {
    id: "P-006",
    admissionDate: date("2026-01-09"),
    dischargeDate: date("2026-01-24"),
    admissionSystolic: 151,
    dischargeSystolic: 139,
    admissionWeight: 78.3,
    dischargeWeight: 71.9,
  },
  {
    id: "P-007",
    admissionDate: date("2026-01-11"),
    dischargeDate: date("2026-01-19"),
    admissionSystolic: 159,
    dischargeSystolic: 137,
    admissionWeight: 84.8,
    dischargeWeight: 82.0,
  },
  {
    id: "P-008",
    admissionDate: date("2026-01-12"),
    dischargeDate: date("2026-01-13"),
    admissionSystolic: 131,
    dischargeSystolic: 128,
    admissionWeight: 63.2,
    dischargeWeight: 63.4,
  },
  {
    id: "P-009",
    admissionDate: date("2026-01-15"),
    dischargeDate: date("2026-01-22"),
    admissionSystolic: 172,
    dischargeSystolic: 152,
    admissionWeight: 96.6,
    dischargeWeight: 92.4,
  },
  {
    id: "P-010",
    admissionDate: date("2026-01-16"),
    dischargeDate: date("2026-02-02"),
    admissionSystolic: 149,
    dischargeSystolic: 132,
    admissionWeight: 70.9,
    dischargeWeight: 69.8,
  },
  {
    id: "P-011",
    admissionDate: date("2026-01-17"),
    dischargeDate: date("2026-01-26"),
    admissionSystolic: 145,
    dischargeSystolic: 144,
    admissionWeight: 73.0,
    dischargeWeight: 78.6,
  },
  {
    id: "P-012",
    admissionDate: date("2026-01-18"),
    dischargeDate: date("2026-01-25"),
    admissionSystolic: 160,
    dischargeSystolic: 130,
    admissionWeight: 88.5,
    dischargeWeight: 84.7,
  },
  {
    id: "P-013",
    admissionDate: date("2026-01-20"),
    dischargeDate: date("2026-01-27"),
    admissionSystolic: 138,
    dischargeSystolic: 133,
    admissionWeight: 66.4,
    dischargeWeight: 64.1,
  },
  {
    id: "P-014",
    admissionDate: date("2026-01-21"),
    dischargeDate: date("2026-02-07"),
    admissionSystolic: 177,
    dischargeSystolic: 148,
    admissionWeight: 101.2,
    dischargeWeight: 98.1,
  },
  {
    id: "P-015",
    admissionDate: date("2026-01-22"),
    dischargeDate: date("2026-01-28"),
    admissionSystolic: 150,
    dischargeSystolic: 121,
    admissionWeight: 79.0,
    dischargeWeight: 73.5,
  },
  {
    id: "P-016",
    admissionDate: date("2026-01-24"),
    dischargeDate: date("2026-01-29"),
    admissionSystolic: 143,
    dischargeSystolic: 128,
    admissionWeight: 61.8,
    dischargeWeight: 60.2,
  },
  {
    id: "P-017",
    admissionDate: date("2026-01-25"),
    dischargeDate: date("2026-02-03"),
    admissionSystolic: 166,
    dischargeSystolic: 166,
    admissionWeight: 87.7,
    dischargeWeight: 85.0,
  },
  {
    id: "P-018",
    admissionDate: date("2026-01-27"),
    dischargeDate: date("2026-02-05"),
    admissionSystolic: 158,
    dischargeSystolic: 143,
    admissionWeight: 92.2,
    dischargeWeight: 88.9,
  },
  {
    id: "P-019",
    admissionDate: date("2026-01-28"),
    dischargeDate: date("2026-02-01"),
    admissionSystolic: 129,
    dischargeSystolic: 124,
    admissionWeight: 58.7,
    dischargeWeight: 58.2,
  },
  {
    id: "P-020",
    admissionDate: date("2026-01-29"),
    dischargeDate: date("2026-02-11"),
    admissionSystolic: 169,
    dischargeSystolic: 145,
    admissionWeight: 94.4,
    dischargeWeight: 89.7,
  },
  {
    id: "P-021",
    admissionDate: date("2026-02-01"),
    dischargeDate: date("2026-02-09"),
    admissionSystolic: 141,
    dischargeSystolic: 118,
    admissionWeight: 75.9,
    dischargeWeight: 70.1,
  },
  {
    id: "P-022",
    admissionDate: date("2026-02-02"),
    dischargeDate: date("2026-02-12"),
    admissionSystolic: 154,
    dischargeSystolic: 140,
    admissionWeight: 80.5,
    dischargeWeight: 77.6,
  },
  {
    id: "P-023",
    admissionDate: date("2026-02-04"),
    dischargeDate: date("2026-02-20"),
    admissionSystolic: 162,
    dischargeSystolic: 136,
    admissionWeight: 83.1,
    dischargeWeight: 79.9,
  },
  {
    id: "P-024",
    admissionDate: date("2026-02-05"),
    dischargeDate: date("2026-02-14"),
    admissionSystolic: 147,
    dischargeSystolic: 132,
    admissionWeight: 69.4,
    dischargeWeight: 67.9,
  },
];

const numberFieldOptions = [
  { label: "admissionSystolic", value: "admissionSystolic" },
  { label: "dischargeSystolic", value: "dischargeSystolic" },
  { label: "admissionWeight", value: "admissionWeight" },
  { label: "dischargeWeight", value: "dischargeWeight" },
] satisfies { label: string; value: keyof PatientRecord }[];

const dateFieldOptions = [
  { label: "admissionDate", value: "admissionDate" },
  { label: "dischargeDate", value: "dischargeDate" },
] satisfies { label: string; value: keyof PatientRecord }[];

const toFieldArg = (field: keyof PatientRecord): FilterArgExpression => ({
  type: "field",
  path: [field],
});

const getFieldArgValue = (
  value: unknown,
  fallback: keyof PatientRecord,
): keyof PatientRecord => {
  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    value.type === "field" &&
    "path" in value &&
    Array.isArray(value.path) &&
    typeof value.path[0] === "string"
  ) {
    return value.path[0] as keyof PatientRecord;
  }
  return fallback;
};

const getNumberValue = (value: unknown, fallback: number) =>
  typeof value === "number" ? value : fallback;

const numberFieldInput: DataInputViewSpec = {
  name: "patient number field input",
  match: [z.number()],
  view: ({ rule, updateInput }) => {
    const selectedField = getFieldArgValue(rule.args[0], "admissionSystolic");
    return (
      <>
        <span>field</span>
        <select
          value={selectedField}
          onChange={(event) => {
            updateInput(toFieldArg(event.target.value as keyof PatientRecord));
          }}
        >
          {numberFieldOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </>
    );
  },
};

const numberFieldThresholdInput: DataInputViewSpec = {
  name: "patient number field threshold input",
  match: [z.number(), z.number()],
  view: ({ rule, updateInput }) => {
    const selectedField = getFieldArgValue(rule.args[0], "admissionWeight");
    const threshold = getNumberValue(rule.args[1], 5);
    return (
      <>
        <span>field</span>
        <select
          value={selectedField}
          onChange={(event) => {
            updateInput(
              toFieldArg(event.target.value as keyof PatientRecord),
              threshold,
            );
          }}
        >
          {numberFieldOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span>threshold</span>
        <input
          type="number"
          value={threshold}
          onChange={(event) => {
            updateInput(
              toFieldArg(selectedField),
              event.target.value.length ? +event.target.value : 0,
            );
          }}
          style={{ width: "80px" }}
        />
      </>
    );
  },
};

const dateRangeComparisonInput: DataInputViewSpec = {
  name: "patient date range comparison input",
  match: [z.date(), z.number(), z.number()],
  view: ({ rule, updateInput }) => {
    const selectedField = getFieldArgValue(rule.args[0], "dischargeDate");
    const minDays = getNumberValue(rule.args[1], 1);
    const maxDays = getNumberValue(rule.args[2], 14);
    return (
      <>
        <span>base</span>
        <select
          value={selectedField}
          onChange={(event) => {
            updateInput(
              toFieldArg(event.target.value as keyof PatientRecord),
              minDays,
              maxDays,
            );
          }}
        >
          {dateFieldOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span>min days</span>
        <input
          type="number"
          value={minDays}
          onChange={(event) => {
            updateInput(
              toFieldArg(selectedField),
              event.target.value.length ? +event.target.value : 0,
              maxDays,
            );
          }}
          style={{ width: "80px" }}
        />
        <span>max days</span>
        <input
          type="number"
          value={maxDays}
          onChange={(event) => {
            updateInput(
              toFieldArg(selectedField),
              minDays,
              event.target.value.length ? +event.target.value : 0,
            );
          }}
          style={{ width: "80px" }}
        />
      </>
    );
  },
};

const patientFilterTheme = createFilterTheme({
  dataInputViews: [
    numberFieldInput,
    numberFieldThresholdInput,
    dateRangeComparisonInput,
  ],
});

const patientCustomFilters: FnSchema[] = [
  defineTypedFn({
    name: "is less than selected column",
    define: z.function({
      input: [z.number(), z.number()],
      output: z.boolean(),
    }),
    implement: (value, otherValue) => value < otherValue,
  }),
  defineTypedFn({
    name: "absolute difference from column is at most",
    define: z.function({
      input: [z.number(), z.number(), z.number()],
      output: z.boolean(),
    }),
    implement: (value, otherValue, threshold) =>
      Math.abs(value - otherValue) <= threshold,
  }),
  defineTypedFn({
    name: "is days before selected date",
    define: z.function({
      input: [z.date(), z.date(), z.number(), z.number()],
      output: z.boolean(),
    }),
    implement: (value, baseDate, minDays, maxDays) => {
      const daysBefore =
        (baseDate.getTime() - value.getTime()) / (24 * 60 * 60 * 1000);
      return daysBefore >= minDays && daysBefore <= maxDays;
    },
  }),
];

const patientCustomFilterList = [
  ...patientCustomFilters,
  ...presetFilter.filter((filter) => filter.name === "contains"),
];

const customDefaultRule = createFilterGroup({
  op: "and",
  conditions: [
    createSingleFilter({
      path: ["admissionDate"],
      name: "is days before selected date",
      args: [toFieldArg("dischargeDate"), 1, 14],
    }),
    createSingleFilter({
      path: ["dischargeSystolic"],
      name: "is less than selected column",
      args: [toFieldArg("admissionSystolic")],
    }),
    createSingleFilter({
      path: ["dischargeWeight"],
      name: "absolute difference from column is at most",
      args: [toFieldArg("admissionWeight"), 5],
    }),
  ],
});

export function PatientFilterExample() {
  const [filteredData, setFilteredData] =
    useState<PatientRecord[]>(patientData);
  const { context } = useFilterSphere({
    schema: patientSchema,
    filterFnList: presetFilter,
    onRuleChange: ({ predicate }) => {
      setFilteredData(patientData.filter(predicate));
    },
  });

  return (
    <FilterSphereProvider context={context}>
      <FilterBuilder />
      <div className="mt-4">
        <Table
          data={filteredData}
          schema={patientSchema}
          className="max-h-[620px]"
        />
      </div>
    </FilterSphereProvider>
  );
}

export function PatientCustomFilterExample() {
  const [filteredData, setFilteredData] =
    useState<PatientRecord[]>(patientData);
  const { context } = useFilterSphere({
    schema: patientSchema,
    defaultRule: customDefaultRule,
    filterFnList: patientCustomFilterList,
    onRuleChange: ({ predicate }) => {
      setFilteredData(patientData.filter(predicate));
    },
  });

  return (
    <FilterSphereProvider context={context} theme={patientFilterTheme}>
      <FilterBuilder />
      <div className="mt-4">
        <Table
          data={filteredData}
          schema={patientSchema}
          className="max-h-[620px]"
        />
      </div>
    </FilterSphereProvider>
  );
}
