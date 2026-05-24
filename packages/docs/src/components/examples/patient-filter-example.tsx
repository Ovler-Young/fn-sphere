import {
  createFilterTheme,
  createFilterGroup,
  createSingleFilter,
  defineTypedFn,
  type DataInputViewProps,
  type DataInputViewSpec,
  FilterBuilder,
  FilterSphereProvider,
  type FnSchema,
  presetFilter,
  useFilterSphere,
  useView,
} from "@fn-sphere/filter";
import { useMemo, type ReactNode } from "react";
import { z } from "zod";
import type { $ZodTypes } from "zod/v4/core";
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
type PatientField = keyof PatientRecord;
type PatientFieldArg = {
  type: "field";
  path: [PatientField];
};

const patientFields = Object.keys(patientSchema.shape) as PatientField[];

const patientFilterNames = {
  lessThanField: "less than field",
  absoluteDifferenceAtMost: "absolute difference from field is at most",
  daysBeforeBetween: "days before date between",
} as const;

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

const toFieldArg = (field: PatientField): PatientFieldArg => ({
  type: "field",
  path: [field],
});

const isFieldArg = (value: unknown): value is PatientFieldArg => {
  const maybeFieldArg = value as Partial<PatientFieldArg>;
  return (
    !!value &&
    typeof value === "object" &&
    maybeFieldArg.type === "field" &&
    Array.isArray(maybeFieldArg.path)
  );
};

const getFieldArgValue = (
  value: unknown,
  fallback: PatientField,
): PatientField => {
  if (isFieldArg(value) && typeof value.path[0] === "string") {
    return value.path[0] as PatientField;
  }
  return fallback;
};

const getNumberValue = (value: unknown, fallback: number) =>
  typeof value === "number" ? value : fallback;

const getSchemaType = (schema: unknown) =>
  (schema as $ZodTypes | undefined)?._zod.def.type;

const DataInputGroup = ({ children }: { children: ReactNode }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    }}
  >
    {children}
  </span>
);

const FieldArgSelect = ({
  context,
  fieldSchema,
  rulePath,
  value,
  fallback,
  onChange,
}: {
  context: DataInputViewProps["context"];
  fieldSchema: DataInputViewProps["fieldSchema"];
  rulePath: DataInputViewProps["rule"]["path"];
  value: unknown;
  fallback: PatientField;
  onChange: (field: PatientField) => void;
}) => {
  const { Select } = useView("components");
  const selectedType = getSchemaType(fieldSchema);
  const options = useMemo(
    () =>
      context.filterableFields
        .filter((option) => {
          if (!fieldSchema) {
            return false;
          }
          const field = option.path[0];
          return (
            typeof field === "string" &&
            patientFields.includes(field as PatientField) &&
            getSchemaType(option.fieldSchema) === selectedType &&
            option.path.join(".") !== (rulePath?.join(".") ?? "")
          );
        })
        .map((option) => ({
          label: context.getLocaleText(context.mapFieldName(option)),
          value: option.path[0] as PatientField,
        })),
    [context, fieldSchema, rulePath, selectedType],
  );
  const selectedValue = getFieldArgValue(value, fallback);
  const resolvedValue =
    options.some((option) => option.value === selectedValue) || !options[0]
      ? selectedValue
      : options[0].value;

  return (
    <Select
      options={options}
      value={resolvedValue}
      onChange={(field) => {
        onChange(field);
      }}
    />
  );
};

const numberFieldInput: DataInputViewSpec = {
  name: "patient number field input",
  match: ({ selectedFilter }) =>
    selectedFilter?.name === patientFilterNames.lessThanField,
  view: function View(props) {
    const { context, fieldSchema, rule, updateInput } = props;
    return (
      <DataInputGroup>
        <FieldArgSelect
          context={context}
          fieldSchema={fieldSchema}
          rulePath={rule.path}
          value={rule.args[0]}
          fallback="admissionSystolic"
          onChange={(field) => {
            updateInput(toFieldArg(field));
          }}
        />
      </DataInputGroup>
    );
  },
};

const numberFieldThresholdInput: DataInputViewSpec = {
  name: "patient number field threshold input",
  match: ({ selectedFilter }) =>
    selectedFilter?.name === patientFilterNames.absoluteDifferenceAtMost,
  view: function View(props) {
    const { Input: InputView } = useView("components");
    const { context, fieldSchema, rule, updateInput } = props;
    const selectedField = getFieldArgValue(rule.args[0], "admissionWeight");
    const threshold = getNumberValue(rule.args[1], 5);
    return (
      <DataInputGroup>
        <FieldArgSelect
          context={context}
          fieldSchema={fieldSchema}
          rulePath={rule.path}
          value={rule.args[0]}
          fallback="admissionWeight"
          onChange={(field) => {
            updateInput(toFieldArg(field), threshold);
          }}
        />
        <span>threshold</span>
        <InputView
          type="number"
          value={threshold}
          onChange={(value) => {
            updateInput(toFieldArg(selectedField), value.length ? +value : 0);
          }}
          style={{ width: "80px" }}
        />
      </DataInputGroup>
    );
  },
};

const dateRangeComparisonInput: DataInputViewSpec = {
  name: "patient date range comparison input",
  match: ({ selectedFilter }) =>
    selectedFilter?.name === patientFilterNames.daysBeforeBetween,
  view: function View(props) {
    const { Input: InputView } = useView("components");
    const { context, fieldSchema, rule, updateInput } = props;
    const selectedField = getFieldArgValue(rule.args[0], "dischargeDate");
    const minDays = getNumberValue(rule.args[1], 1);
    const maxDays = getNumberValue(rule.args[2], 14);
    return (
      <DataInputGroup>
        <FieldArgSelect
          context={context}
          fieldSchema={fieldSchema}
          rulePath={rule.path}
          value={rule.args[0]}
          fallback="dischargeDate"
          onChange={(field) => {
            updateInput(toFieldArg(field), minDays, maxDays);
          }}
        />
        <span>min days</span>
        <InputView
          type="number"
          value={minDays}
          onChange={(value) => {
            updateInput(
              toFieldArg(selectedField),
              value.length ? +value : 0,
              maxDays,
            );
          }}
          style={{ width: "80px" }}
        />
        <span>max days</span>
        <InputView
          type="number"
          value={maxDays}
          onChange={(value) => {
            updateInput(
              toFieldArg(selectedField),
              minDays,
              value.length ? +value : 0,
            );
          }}
          style={{ width: "80px" }}
        />
      </DataInputGroup>
    );
  },
};

const patientFilterTheme = createFilterTheme({
  primitives: {
    input: ({ style, ...props }) => (
      <input
        {...props}
        style={{
          minWidth: 0,
          maxWidth: "100%",
          ...style,
        }}
      />
    ),
  },
  dataInputViews: [
    numberFieldInput,
    numberFieldThresholdInput,
    dateRangeComparisonInput,
  ],
});

const patientCustomFilters: FnSchema[] = [
  defineTypedFn({
    name: patientFilterNames.lessThanField,
    define: z.function({
      input: [z.number(), z.number()],
      output: z.boolean(),
    }),
    implement: (value, otherValue) => value < otherValue,
  }),
  defineTypedFn({
    name: patientFilterNames.absoluteDifferenceAtMost,
    define: z.function({
      input: [z.number(), z.number(), z.number()],
      output: z.boolean(),
    }),
    implement: (value, otherValue, threshold) =>
      Math.abs(value - otherValue) <= threshold,
  }),
  defineTypedFn({
    name: patientFilterNames.daysBeforeBetween,
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

const customDefaultRule = createFilterGroup({
  op: "and",
  conditions: [
    createSingleFilter({
      path: ["admissionDate"],
      name: patientFilterNames.daysBeforeBetween,
      args: [toFieldArg("dischargeDate"), 1, 14],
    }),
    createSingleFilter({
      path: ["dischargeSystolic"],
      name: patientFilterNames.lessThanField,
      args: [toFieldArg("admissionSystolic")],
    }),
    createSingleFilter({
      path: ["dischargeWeight"],
      name: patientFilterNames.absoluteDifferenceAtMost,
      args: [toFieldArg("admissionWeight"), 5],
    }),
  ],
});

export function PatientCustomFilterExample() {
  const { context, predicate } = useFilterSphere({
    schema: patientSchema,
    defaultRule: customDefaultRule,
    filterFnList: [...presetFilter, ...patientCustomFilters],
  });
  const filteredData = patientData.filter(predicate);

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
