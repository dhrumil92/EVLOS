import { useId } from 'react';

export interface FieldSpec<Name extends string> {
  name: Name;
  label: string;
  type?: string;
}

export const DETAIL_FIELDS: FieldSpec<'name' | 'room' | 'email' | 'phone'>[] = [
  { name: 'name', label: 'Name' },
  { name: 'room', label: 'Room' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone (optional)', type: 'tel' },
];

const FIELD_HELP: Record<string, string> = {
  studentId: 'Enter the Student ID as a number.',
  name: 'Enter the name.',
  room: 'Enter the room as three digits, such as 205.',
  email: 'Enter a valid email address.',
};

export const errorsFor = (fields: readonly string[]): Record<string, string> =>
  Object.fromEntries(fields.map((field) => [field, FIELD_HELP[field] ?? '']));

export function FieldInputs<Name extends string>(props: {
  fields: readonly FieldSpec<Name>[];
  values: Record<Name, string>;
  errors: Record<string, string>;
  onChange: (name: Name, value: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
      {props.fields.map((field) => {
        const error = props.errors[field.name];
        const errorId = `${id}-${field.name}-error`;
        return (
          <div key={field.name} className="grid content-start gap-1">
            <label className="grid gap-1 text-muted">
              {field.label}
              <input
                className="field"
                type={field.type ?? 'text'}
                value={props.values[field.name]}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => {
                  props.onChange(field.name, event.target.value);
                }}
              />
            </label>
            {error && (
              <span id={errorId} className="field-error">
                {error}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
