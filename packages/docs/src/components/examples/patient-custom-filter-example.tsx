import {
  createFilterTheme,
  type DataInputViewSpec,
  FilterBuilder,
  FilterSphereProvider,
  type SingleFilter,
  useFilterRule,
  useFilterSphere,
  useView,
} from "@fn-sphere/filter";
import { useMemo, type CSSProperties } from "react";
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

type PatientSingleFilterProps = {
  rule: SingleFilter;
  className?: string;
  style?: CSSProperties;
};

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

const getLeftField = (ruleArgs: unknown[], filterName?: string) => {
  if (filterName === "date field is days before another date field") {
    return getDateRangeInput(ruleArgs[0]).leftField;
  }
  return getNumberComparisonInput(ruleArgs[0]).leftField;
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

const patientFilterOptions = patientCustomFilters.map((filter) => ({
  label: filter.name,
  value: filter,
}));

const LeftFieldSelect = ({ rule }: PatientSingleFilterProps) => {
  const { setRule } = useFilterRule(rule);
  if (rule.name === "date field is days before another date field") {
    const value = getDateRangeInput(rule.args[0]);
    return (
      <DateFieldSelect
        value={value.leftField}
        onChange={(leftField) =>
          setRule({
            ...rule,
            path: [],
            args: [{ ...value, leftField }],
          })
        }
      />
    );
  }
  const value = getNumberComparisonInput(rule.args[0]);
  return (
    <NumberFieldSelect
      value={value.leftField}
      onChange={(leftField) =>
        setRule({
          ...rule,
          path: [],
          args: [{ ...value, leftField }],
        })
      }
    />
  );
};

const PatientFilterSelect = ({ rule }: PatientSingleFilterProps) => {
  const { setRule } = useFilterRule(rule);
  const { Select: SelectView } = useView("components");
  const selectedFilter = patientCustomFilters.find(
    (filter) => filter.name === rule.name,
  );
  const leftField = getLeftField(rule.args, rule.name);

  return (
    <SelectView
      value={selectedFilter}
      options={patientFilterOptions}
      onChange={(filter) => {
        const nextArgs =
          filter.name === "date field is days before another date field"
            ? [
                {
                  leftField: dateFieldOptions.includes(leftField as DateField)
                    ? (leftField as DateField)
                    : "admissionDate",
                  rightField: "dischargeDate",
                  minDays: 1,
                  maxDays: 14,
                } satisfies DateRangeInput,
              ]
            : [
                {
                  leftField: numberFieldOptions.includes(
                    leftField as NumberField,
                  )
                    ? (leftField as NumberField)
                    : "dischargeSystolic",
                  rightField: "admissionSystolic",
                  threshold: 5,
                } satisfies NumberComparisonInput,
              ];
        setRule({
          ...rule,
          path: [],
          name: filter.name,
          args: nextArgs,
        });
      }}
    />
  );
};

const numberComparisonInput: DataInputViewSpec = {
  name: "patient number comparison input",
  match: [numberComparisonInputSchema],
  view: ({ rule, updateInput }) => {
    const value = getNumberComparisonInput(rule.args[0]);
    return (
      <>
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

const PatientSingleFilter = ({ rule, ...props }: PatientSingleFilterProps) => {
  const {
    ruleState: { isInvert },
    removeRule,
  } = useFilterRule(rule);
  const { Button: ButtonView } = useView("components");
  const { FilterDataInput, SingleFilterContainer } = useView("templates");

  return (
    <SingleFilterContainer rule={rule} {...props}>
      <LeftFieldSelect rule={rule} />
      {isInvert ? "not" : null}
      <PatientFilterSelect rule={rule} />
      <FilterDataInput rule={rule} />
      <ButtonView onClick={() => removeRule(true)}>delete</ButtonView>
    </SingleFilterContainer>
  );
};

const patientFilterTheme = createFilterTheme({
  dataInputViews: [numberComparisonInput, dateRangeInput],
  templates: {
    SingleFilter: PatientSingleFilter,
  },
});

export function PatientCustomFilterExample() {
  const { context, predicate } = useFilterSphere({
    schema: patientSchema,
    defaultRule,
    filterFnList: patientCustomFilters,
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
