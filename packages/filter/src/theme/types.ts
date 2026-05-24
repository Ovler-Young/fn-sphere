import type { SingleFilter, StandardFnSchema } from "@fn-sphere/core";
import type {
  ButtonHTMLAttributes,
  ComponentType,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import type { $ZodTuple, $ZodType } from "zod/v4/core";
import type {
  MultiSelectProps,
  SingleSelectProps,
} from "../views/components.js";
import type { FieldSelectProps } from "../views/field-select.js";
import type { DataInputProps } from "../views/filter-data-input.js";
import type { FilterGroupContainerProps } from "../views/filter-group-container.js";
import type { FilterGroupProps } from "../views/filter-group.js";
import type { FilterSelectProps } from "../views/filter-select.js";
import type { RuleJoinerProps } from "../views/rule-joiner.js";
import type { SingleFilterContainerProps } from "../views/single-filter-container.js";
import type { SingleFilterRuleProps } from "../views/single-filter.js";
import type { FilterSchemaContext } from "../hooks/use-filter-schema-context.js";

export type DataInputViewProps = {
  rule: SingleFilter;
  context: FilterSchemaContext;
  fieldSchema: $ZodType | undefined;
  selectedFilter: StandardFnSchema | undefined;
  requiredDataSchema: $ZodTuple;
  updateInput: (...input: unknown[]) => void;
};

export type DataInputViewMatchContext = {
  rule: SingleFilter | undefined;
  context: FilterSchemaContext | undefined;
  fieldSchema: $ZodType | undefined;
  selectedFilter: StandardFnSchema | undefined;
  parameterSchemas: $ZodTuple;
  requiredDataSchema: $ZodTuple;
};

export type DataInputViewMatchInput = DataInputViewMatchContext & $ZodTuple;

export type DataInputViewMatchFn = (
  // The first parameter is kept as the real tuple schema from the previous API.
  parameterSchemas: DataInputViewMatchInput,
  // The second parameter is kept for the previous `(parameterSchemas, fieldSchema)` API.
  fieldSchema?: $ZodType,
  // Additional context is available to custom views without replacing the tuple argument.
  context?: DataInputViewMatchContext,
) => boolean;

export type DataInputViewSpec = {
  name: string;
  match: [] | [$ZodType, ...$ZodType[]] | $ZodTuple | DataInputViewMatchFn;
  view: ComponentType<DataInputViewProps>;
  meta?: Record<string, unknown>;
};

export type FilterTheme = {
  primitives: {
    button: ComponentType<ButtonHTMLAttributes<HTMLButtonElement>>;
    input: ComponentType<InputHTMLAttributes<HTMLInputElement>>;
    select: ComponentType<InputHTMLAttributes<HTMLSelectElement>>;
    option: ComponentType<InputHTMLAttributes<HTMLOptionElement>>;
  };
  components: {
    Button: ComponentType<ButtonHTMLAttributes<HTMLButtonElement>>;
    Input: ComponentType<
      Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
        onChange?: (value: string) => void;
      }
    >;
    // Select: ComponentType<SelectProps<unknown> & RefAttributes<HTMLElement>>;
    Select: <T>(props: SingleSelectProps<T>) => ReactNode;
    MultipleSelect: <T>(props: MultiSelectProps<T>) => ReactNode;
    ErrorBoundary: ComponentType<{
      children: ReactNode;
      fallback?: ReactNode;
      onDelete?: () => void;
    }>;
  };
  templates: {
    FilterGroupContainer: ComponentType<FilterGroupContainerProps>;
    SingleFilterContainer: ComponentType<SingleFilterContainerProps>;
    RuleJoiner: ComponentType<RuleJoinerProps>;
    FieldSelect: ComponentType<FieldSelectProps>;
    FilterSelect: ComponentType<FilterSelectProps>;
    FilterDataInput: ComponentType<DataInputProps>;
    SingleFilter: ComponentType<SingleFilterRuleProps>;
    FilterGroup: ComponentType<FilterGroupProps>;
  };
  dataInputViews: DataInputViewSpec[];
};

/**
 * @deprecated use {@link FilterTheme} instead
 */
export type ThemeSpec = FilterTheme;
