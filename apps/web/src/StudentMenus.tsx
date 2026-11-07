import { PopoverMenu } from './PopoverMenu.js';
import { GROUPS, groupCounts, SORTS } from './student-list.js';
import type { ListChoices, StudentSort } from './student-list.js';
import type { ListedStudent } from './student-source.js';

// One button for the five filters: Active, in hostel, Away, Due Back and Deactivated.
function FilterMenu(props: {
  students: readonly ListedStudent[];
  choices: ListChoices;
  onChoices: (change: Partial<ListChoices>) => void;
}) {
  const counts = groupCounts(props.students);
  return (
    <PopoverMenu name="Filter" label={`Filter: ${props.choices.group}`}>
      {(close) =>
        GROUPS.map((group) => {
          const isOn = group === props.choices.group;
          return (
            <button
              key={group}
              type="button"
              aria-pressed={isOn}
              onClick={() => {
                props.onChoices({ group });
                close();
              }}
              className={`flex min-h-11 items-center justify-between gap-6 rounded-xl px-3 text-left font-bold ${isOn ? 'bg-primary text-white' : 'hover:bg-tint'}`}
            >
              {group}{' '}
              <span className={`font-normal ${isOn ? 'text-on-primary-muted' : 'text-muted'}`}>
                {counts[group]}
              </span>
            </button>
          );
        })
      }
    </PopoverMenu>
  );
}

// One button for the floor and the sort order.
function SortMenu(props: {
  students: readonly ListedStudent[];
  choices: ListChoices;
  onChoices: (change: Partial<ListChoices>) => void;
}) {
  const { choices } = props;
  const floors = [...new Set(props.students.map((s) => s.floor))].sort((a, b) => a - b);
  return (
    <PopoverMenu name="Floor and sort" label="Floor and sort">
      {() => (
        <>
          <label className="grid gap-1 text-sm font-bold text-muted">
            Floor
            <select
              className="field font-normal"
              value={choices.floor === null ? '' : String(choices.floor)}
              onChange={(event) => {
                props.onChoices({
                  floor: event.target.value === '' ? null : Number(event.target.value),
                });
              }}
            >
              <option value="">All floors</option>
              {floors.map((floor) => (
                <option key={floor} value={String(floor)}>
                  Floor {floor}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-muted">
            Sort by
            <select
              className="field font-normal"
              value={choices.sort}
              onChange={(event) => {
                props.onChoices({ sort: event.target.value as StudentSort });
              }}
            >
              {SORTS.map((sort) => (
                <option key={sort}>{sort}</option>
              ))}
            </select>
          </label>
        </>
      )}
    </PopoverMenu>
  );
}

// The two menus that sit before Add a Student.
export function StudentMenus(props: {
  students: readonly ListedStudent[];
  choices: ListChoices;
  onChoices: (change: Partial<ListChoices>) => void;
}) {
  return (
    <>
      <FilterMenu {...props} />
      <SortMenu {...props} />
    </>
  );
}
