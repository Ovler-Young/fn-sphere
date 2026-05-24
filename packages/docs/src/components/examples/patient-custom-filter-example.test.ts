import { createFilterPredicate, createSingleFilter } from "@fn-sphere/core";
import { describe, expect, test } from "vitest";
import {
  defaultRule,
  patientCustomFilters,
  patientData,
  patientSchema,
} from "./patient-custom-filter-data";

describe("patient custom filter example", () => {
  test("default rule filters the patient dataset", () => {
    const predicate = createFilterPredicate({
      schema: patientSchema,
      filterFnList: patientCustomFilters,
      filterRule: defaultRule,
    });

    const filteredPatients = patientData.filter(predicate);

    expect(filteredPatients.length).toBeGreaterThan(0);
    expect(filteredPatients.length).toBeLessThan(patientData.length);
  });

  test("custom field comparison rule updates filtered rows", () => {
    const predicate = createFilterPredicate({
      schema: patientSchema,
      filterFnList: patientCustomFilters,
      filterRule: createSingleFilter({
        path: [],
        name: "numeric field is less than another field",
        args: [
          {
            leftField: "admissionSystolic",
            rightField: "dischargeSystolic",
            threshold: 0,
          },
        ],
      }),
    });

    const filteredPatients = patientData.filter(predicate);

    expect(filteredPatients.map((patient) => patient.id)).toEqual(["P-003"]);
  });
});
