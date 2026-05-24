import {
  createFilterTheme,
  type DataInputViewSpec,
  FilterBuilder,
  FilterSphereProvider,
  useFilterSphere,
} from "@fn-sphere/filter";
import { useMemo, type ReactNode } from "react";
import { Table } from "~/components/table";
import {
  dateFieldOptions,
  dateRangeInputSchema,
  defaultRule,
  type DateField,
  type DateRangeInput,
  type NumberComparisonInput,
  type NumberField,
  numberComparisonInputSchema,
  numberFieldOptions,
  patientCustomFilters,
  patientData,
  patientSchema,
} from "./patient-custom-filter-data";

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

const numberComparisonInput: DataInputViewSpec = {
  name: "patient number comparison input",
  match: [numberComparisonInputSchema],
  view: ({ rule, updateInput }) => {
    const value = getNumberComparisonInput(rule.args[0]);
    return (
      <DataInputGroup>
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
      </DataInputGroup>
    );
  },
};

const dateRangeInput: DataInputViewSpec = {
  name: "patient date range input",
  match: [dateRangeInputSchema],
  view: ({ rule, updateInput }) => {
    const value = getDateRangeInput(rule.args[0]);
    return (
      <DataInputGroup>
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
      </DataInputGroup>
    );
  },
};

const patientFilterTheme = createFilterTheme({
  dataInputViews: [numberComparisonInput, dateRangeInput],
});

export function PatientCustomFilterExample() {
  const { context, predicate } = useFilterSphere({
    schema: patientSchema,
    defaultRule,
    filterFnList: patientCustomFilters,
    mapFieldName: (field) => (field.path.length === 0 ? "patient" : ""),
  });
  const filteredPatients = useMemo(
    () => patientData.filter(predicate),
    [predicate],
  );

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
