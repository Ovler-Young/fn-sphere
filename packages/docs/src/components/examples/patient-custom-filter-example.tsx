import {
  createFilterGroup,
  createFilterTheme,
  createSingleFilter,
  defineTypedFn,
  type DataInputViewSpec,
  FilterBuilder,
  FilterSphereProvider,
  type FnSchema,
  useFilterSphere,
} from "@fn-sphere/filter";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Table } from "~/components/table";

const patientSchema = z.object({
  id: z.string(),
  admissionDate: z.date(),
  dischargeDate: z.date(),
  admissionSystolic: z.number(),
  dischargeSystolic: z.number(),
  admissionWeight: z.number(),
  dischargeWeight: z.number(),
});

const rowSchema = z.object({
  patient: patientSchema.describe("Patient"),
});

type PatientRecord = z.infer<typeof patientSchema>;
type PatientRow = z.infer<typeof rowSchema>;
type NumberField = Extract<
  keyof PatientRecord,
  | "admissionSystolic"
  | "dischargeSystolic"
  | "admissionWeight"
  | "dischargeWeight"
>;
type DateField = Extract<
  keyof PatientRecord,
  "admissionDate" | "dischargeDate"
>;

type NumberComparisonInput = {
  leftField: NumberField;
  rightField: NumberField;
  threshold: number;
};

type DateRangeInput = {
  leftField: DateField;
  rightField: DateField;
  minDays: number;
  maxDays: number;
};

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

const patientRows = patientData.map((patient) => ({ patient }));

const numberFieldOptions = [
  "admissionSystolic",
  "dischargeSystolic",
  "admissionWeight",
  "dischargeWeight",
] satisfies NumberField[];

const dateFieldOptions = [
  "admissionDate",
  "dischargeDate",
] satisfies DateField[];

const numberComparisonInputSchema = z.object({
  leftField: z.enum(numberFieldOptions),
  rightField: z.enum(numberFieldOptions),
  threshold: z.number(),
});

const dateRangeInputSchema = z.object({
  leftField: z.enum(dateFieldOptions),
  rightField: z.enum(dateFieldOptions),
  minDays: z.number(),
  maxDays: z.number(),
});

const getNumberComparisonInput = (value: unknown): NumberComparisonInput => {
  const parsed = numberComparisonInputSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  return {
    leftField: "dischargeWeight",
    rightField: "admissionWeight",
    threshold: 5,
  };
};

const getDateRangeInput = (value: unknown): DateRangeInput => {
  const parsed = dateRangeInputSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  return {
    leftField: "admissionDate",
    rightField: "dischargeDate",
    minDays: 1,
    maxDays: 14,
  };
};

const NumberFieldSelect = ({
  value,
  onChange,
}: {
  value: NumberField;
  onChange: (value: NumberField) => void;
}) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value as NumberField)}
  >
    {numberFieldOptions.map((field) => (
      <option key={field} value={field}>
        {field}
      </option>
    ))}
  </select>
);

const DateFieldSelect = ({
  value,
  onChange,
}: {
  value: DateField;
  onChange: (value: DateField) => void;
}) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value as DateField)}
  >
    {dateFieldOptions.map((field) => (
      <option key={field} value={field}>
        {field}
      </option>
    ))}
  </select>
);

const numberComparisonInput: DataInputViewSpec = {
  name: "patient number comparison input",
  match: [numberComparisonInputSchema],
  view: ({ rule, updateInput }) => {
    const value = getNumberComparisonInput(rule.args[0]);
    return (
      <>
        <span>left</span>
        <NumberFieldSelect
          value={value.leftField}
          onChange={(leftField) => updateInput({ ...value, leftField })}
        />
        <span>right</span>
        <NumberFieldSelect
          value={value.rightField}
          onChange={(rightField) => updateInput({ ...value, rightField })}
        />
        <span>threshold</span>
        <input
          type="number"
          value={value.threshold}
          onChange={(event) => {
            updateInput({
              ...value,
              threshold: event.target.value.length ? +event.target.value : 0,
            });
          }}
          style={{ width: "80px" }}
        />
      </>
    );
  },
};

const dateRangeInput: DataInputViewSpec = {
  name: "patient date range input",
  match: [dateRangeInputSchema],
  view: ({ rule, updateInput }) => {
    const value = getDateRangeInput(rule.args[0]);
    return (
      <>
        <span>left date</span>
        <DateFieldSelect
          value={value.leftField}
          onChange={(leftField) => updateInput({ ...value, leftField })}
        />
        <span>right date</span>
        <DateFieldSelect
          value={value.rightField}
          onChange={(rightField) => updateInput({ ...value, rightField })}
        />
        <span>min days</span>
        <input
          type="number"
          value={value.minDays}
          onChange={(event) => {
            updateInput({
              ...value,
              minDays: event.target.value.length ? +event.target.value : 0,
            });
          }}
          style={{ width: "80px" }}
        />
        <span>max days</span>
        <input
          type="number"
          value={value.maxDays}
          onChange={(event) => {
            updateInput({
              ...value,
              maxDays: event.target.value.length ? +event.target.value : 0,
            });
          }}
          style={{ width: "80px" }}
        />
      </>
    );
  },
};

const patientFilterTheme = createFilterTheme({
  dataInputViews: [numberComparisonInput, dateRangeInput],
});

const patientCustomFilters: FnSchema[] = [
  defineTypedFn({
    name: "numeric field is less than another field",
    skipValidate: true,
    define: z.function({
      input: [patientSchema, numberComparisonInputSchema],
      output: z.boolean(),
    }),
    implement: (patient, input) => {
      const value = patient[input.leftField];
      const target = patient[input.rightField];
      return value < target;
    },
  }),
  defineTypedFn({
    name: "numeric field absolute difference is at most",
    skipValidate: true,
    define: z.function({
      input: [patientSchema, numberComparisonInputSchema],
      output: z.boolean(),
    }),
    implement: (patient, input) => {
      const value = patient[input.leftField];
      const target = patient[input.rightField];
      return Math.abs(value - target) <= input.threshold;
    },
  }),
  defineTypedFn({
    name: "date field is days before another date field",
    skipValidate: true,
    define: z.function({
      input: [patientSchema, dateRangeInputSchema],
      output: z.boolean(),
    }),
    implement: (patient, input) => {
      const value = patient[input.leftField];
      const target = patient[input.rightField];
      const daysBefore =
        (target.getTime() - value.getTime()) / (24 * 60 * 60 * 1000);
      return daysBefore >= input.minDays && daysBefore <= input.maxDays;
    },
  }),
];

const defaultRule = createFilterGroup({
  op: "and",
  conditions: [
    createSingleFilter({
      path: ["patient"],
      name: "date field is days before another date field",
      args: [
        {
          leftField: "admissionDate",
          rightField: "dischargeDate",
          minDays: 1,
          maxDays: 14,
        } satisfies DateRangeInput,
      ],
    }),
    createSingleFilter({
      path: ["patient"],
      name: "numeric field is less than another field",
      args: [
        {
          leftField: "dischargeSystolic",
          rightField: "admissionSystolic",
          threshold: 0,
        } satisfies NumberComparisonInput,
      ],
    }),
    createSingleFilter({
      path: ["patient"],
      name: "numeric field absolute difference is at most",
      args: [
        {
          leftField: "dischargeWeight",
          rightField: "admissionWeight",
          threshold: 5,
        } satisfies NumberComparisonInput,
      ],
    }),
  ],
});

const flattenRows = (rows: PatientRow[]) => rows.map((row) => row.patient);

export function PatientCustomFilterExample() {
  const [filteredRows, setFilteredRows] = useState<PatientRow[]>(patientRows);
  const filteredPatients = useMemo(
    () => flattenRows(filteredRows),
    [filteredRows],
  );
  const { context } = useFilterSphere({
    schema: rowSchema,
    fieldDeepLimit: 0,
    defaultRule,
    filterFnList: patientCustomFilters,
    onRuleChange: ({ predicate }) => {
      setFilteredRows(patientRows.filter(predicate));
    },
  });

  return (
    <FilterSphereProvider context={context} theme={patientFilterTheme}>
      <FilterBuilder />
      <div className="mt-4">
        <Table
          data={filteredPatients}
          schema={patientSchema}
          className="max-h-[620px]"
        />
      </div>
    </FilterSphereProvider>
  );
}
