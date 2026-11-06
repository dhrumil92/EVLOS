// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  AddResult,
  EditResult,
  LeaveState,
  ListedStudent,
  StudentDetails,
  StudentForm,
  StudentSource,
} from './student-source.js';
import { StudentsPage } from './StudentsPage.js';

const student = (studentId: string, name: string, room: string, isActive = true) => ({
  studentId,
  name,
  room,
  email: `${studentId}@example.com`,
  phone: null,
  isActive,
  floor: Number(room.charAt(0)),
  leaveState: 'In hostel' as LeaveState,
  openLeave: null,
});

const STUDENTS = [student('9002', 'Bina Rao', '201'), student('9001', 'Asha Rao', '109')];

function fakeSource(answer?: AddResult, failing = false) {
  const state = {
    students: [...STUDENTS] as ListedStudent[],
    forms: [] as StudentForm[],
    edits: [] as [string, StudentDetails][],
    editAnswer: undefined as EditResult | undefined,
    changes: [] as string[],
  };
  const setActive = (studentId: string, isActive: boolean) => {
    state.students = state.students.map((one) =>
      one.studentId === studentId ? { ...one, isActive } : one,
    );
  };
  const source: StudentSource = {
    list: () => (failing ? Promise.reject(new Error('down')) : Promise.resolve(state.students)),
    add: (form) => {
      state.forms.push(form);
      const result = answer ?? {
        outcome: 'added' as const,
        student: { ...form, phone: form.phone || null },
      };
      if (result.outcome === 'added') {
        state.students = [
          ...state.students,
          { ...result.student, isActive: true, floor: 3, leaveState: 'In hostel', openLeave: null },
        ];
      }
      return Promise.resolve(result);
    },
    edit: (studentId, details) => {
      state.edits.push([studentId, details]);
      const edited = { studentId, ...details, phone: details.phone || null };
      const result = state.editAnswer ?? { outcome: 'edited' as const, student: edited };
      if (result.outcome === 'edited') {
        state.students = state.students.map((one) =>
          one.studentId === studentId
            ? { ...one, ...edited, floor: Number(details.room.charAt(0)) }
            : one,
        );
      }
      return Promise.resolve(result);
    },
    deactivate: (studentId) => {
      state.changes.push(`Deactivate ${studentId}`);
      setActive(studentId, false);
      return Promise.resolve();
    },
    activate: (studentId) => {
      state.changes.push(`Activate ${studentId}`);
      setActive(studentId, true);
      return Promise.resolve();
    },
    // Leave and Return have their own tests in LeaveStatus.test.tsx.
    recordLeave: () => Promise.resolve('done'),
    editLeave: () => Promise.resolve('done'),
    cancelLeave: () => Promise.resolve('done'),
    returnLeave: () => Promise.resolve('done'),
    // Leaves and Returns for many Students are on the Leaves page, with their own tests.
    recordLeaves: () => Promise.resolve([]),
    returnLeaves: () => Promise.resolve([]),
  };
  return { source, state };
}

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};
const fillForm = () => {
  type('Student ID', '9003');
  type('Name', 'Chitra Rao');
  type('Room', '301');
  type('Email', 'chitra@example.com');
};
const openForm = async () => {
  await screen.findByText('Bina Rao');
  fireEvent.click(screen.getByRole('button', { name: 'Add a Student' }));
};
const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1]?.textContent);

afterEach(cleanup);

describe('Students page', () => {
  it('lists the Students by room in ascending order', async () => {
    render(<StudentsPage source={fakeSource().source} />);
    await screen.findByText('Bina Rao');

    expect(names()).toEqual(['Asha Rao', 'Bina Rao']);
  });

  it('shows how many Students there are', async () => {
    render(<StudentsPage source={fakeSource().source} />);

    expect(await screen.findByText('Showing 2 of 2 Active Students')).toBeTruthy();
  });

  it.each([
    ['name', 'bina'],
    ['Student ID', '9002'],
    ['room', '201'],
  ])('finds a Student by %s', async (_kind, search) => {
    render(<StudentsPage source={fakeSource().source} />);
    await screen.findByText('Bina Rao');

    type('Search by name, Student ID or room', search);

    expect(names()).toEqual(['Bina Rao']);
  });

  it('says so when no Student matches the search', async () => {
    render(<StudentsPage source={fakeSource().source} />);
    await screen.findByText('Bina Rao');

    type('Search by name, Student ID or room', 'nobody');

    expect(screen.getByText(/No Student matches this search/)).toBeTruthy();
  });

  it('invites the Rector to add the first Student when there are none', async () => {
    const { source, state } = fakeSource();
    state.students = [];

    render(<StudentsPage source={source} />);

    expect(await screen.findByText(/No Students yet/)).toBeTruthy();
  });

  it('adds a Student and shows him in the list without a reload', async () => {
    const { source, state } = fakeSource();
    render(<StudentsPage source={source} />);
    await openForm();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save Student' }));

    expect(await screen.findByText('Added Chitra Rao.')).toBeTruthy();
    expect(screen.getByText('Showing 3 of 3 Active Students')).toBeTruthy();
    expect(state.forms[0]).toMatchObject({ studentId: '9003', phone: '' });
  });

  it('keeps what was typed and marks the field when it is invalid', async () => {
    render(<StudentsPage source={fakeSource({ outcome: 'invalid', fields: ['email'] }).source} />);
    await openForm();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save Student' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Chitra Rao');
  });

  it('explains that a Student ID is never reused', async () => {
    render(<StudentsPage source={fakeSource({ outcome: 'student-id-used' }).source} />);
    await openForm();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save Student' }));

    expect(await screen.findByText(/already used. A Student ID is never reused/)).toBeTruthy();
  });

  it('says how to fix it when the server cannot be reached', async () => {
    render(<StudentsPage source={fakeSource(undefined, true).source} />);

    expect(await screen.findByText(/Start it with npm run dev/)).toBeTruthy();
  });
});

describe('Leave state in the list', () => {
  it('marks Away and Due Back Students, each with a text label', async () => {
    const fake = fakeSource();
    fake.state.students = [
      { ...student('9001', 'Asha Rao', '109'), leaveState: 'Away' },
      { ...student('9002', 'Bina Rao', '201'), leaveState: 'Due Back' },
      student('9003', 'Chitra Rao', '305'),
    ];
    render(<StudentsPage source={fake.source} />);

    const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr');
    const asha = await rowOf('Asha Rao');
    const bina = await rowOf('Bina Rao');
    const chitra = await rowOf('Chitra Rao');
    expect(asha && within(asha).getByText('Away')).toBeTruthy();
    expect(bina && within(bina).getByText('Due Back')).toBeTruthy();
    expect(chitra && within(chitra).queryByText('In hostel')).toBeNull();
  });
});

describe('Deactivated Students in the list', () => {
  const withDeactivated = () => {
    const fake = fakeSource();
    fake.state.students = [...STUDENTS, student('9003', 'Chitra Rao', '305', false)];
    return fake;
  };

  it('lists only Active Students at first', async () => {
    render(<StudentsPage source={withDeactivated().source} />);
    await screen.findByText('Bina Rao');

    expect(names()).toEqual(['Asha Rao', 'Bina Rao']);
    expect(screen.getByText('Showing 2 of 2 Active Students')).toBeTruthy();
  });

  it('shows only the Deactivated Students, marked as Deactivated, when asked', async () => {
    render(<StudentsPage source={withDeactivated().source} />);
    await screen.findByText('Bina Rao');

    fireEvent.click(screen.getByLabelText('Show Deactivated'));

    expect(screen.queryByText('Bina Rao')).toBeNull();
    const row = screen.getByText('Chitra Rao').closest('tr');
    expect(row && within(row).getByText('Deactivated')).toBeTruthy();
    expect(screen.getByText('Showing 1 of 1 Deactivated Students')).toBeTruthy();
  });

  it('says so when no Student is Deactivated', async () => {
    render(<StudentsPage source={fakeSource().source} />);
    await screen.findByText('Bina Rao');

    fireEvent.click(screen.getByLabelText('Show Deactivated'));

    expect(screen.getByText('No Student is Deactivated.')).toBeTruthy();
  });
});

describe('Student settings', () => {
  const openSettings = async (name: string) => {
    fireEvent.click(await screen.findByRole('button', { name: `Settings for ${name}` }));
    return screen.getByRole('region', { name: `Settings for ${name}` });
  };
  const tab = (panel: HTMLElement, name: string) => {
    fireEvent.click(within(panel).getByRole('tab', { name }));
  };

  it('opens with three tabs and Details first', async () => {
    render(<StudentsPage source={fakeSource().source} />);

    const panel = await openSettings('Bina Rao');

    const tabs = within(panel).getAllByRole('tab');
    expect(tabs.map((one) => one.textContent)).toEqual(['Details', 'Leave status', 'Danger zone']);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
  });

  it('closes when the gear is pressed again', async () => {
    render(<StudentsPage source={fakeSource().source} />);
    await openSettings('Bina Rao');

    fireEvent.click(screen.getByRole('button', { name: 'Settings for Bina Rao' }));

    expect(screen.queryByRole('region', { name: 'Settings for Bina Rao' })).toBeNull();
  });

  describe('Details', () => {
    it('starts from the saved details and cannot change the Student ID', async () => {
      render(<StudentsPage source={fakeSource().source} />);

      const panel = await openSettings('Bina Rao');

      expect(within(panel).getByLabelText<HTMLInputElement>('Name').value).toBe('Bina Rao');
      expect(within(panel).queryByLabelText('Student ID')).toBeNull();
      expect(within(panel).getByText(/Student ID 9002 cannot be changed/)).toBeTruthy();
    });

    it('saves the edited details under the same Student ID', async () => {
      const { source, state } = fakeSource();
      render(<StudentsPage source={source} />);
      const panel = await openSettings('Bina Rao');

      fireEvent.change(within(panel).getByLabelText('Room'), { target: { value: '404' } });
      fireEvent.click(within(panel).getByRole('button', { name: 'Save details' }));

      expect(await within(panel).findByText('Saved.')).toBeTruthy();
      expect(state.edits[0]).toEqual([
        '9002',
        { name: 'Bina Rao', room: '404', email: '9002@example.com', phone: '' },
      ]);
      expect(screen.getByText('404')).toBeTruthy();
    });

    it('keeps what was typed and marks the field when it is invalid', async () => {
      const { source, state } = fakeSource();
      state.editAnswer = { outcome: 'invalid', fields: ['email'] };
      render(<StudentsPage source={source} />);
      const panel = await openSettings('Bina Rao');

      fireEvent.change(within(panel).getByLabelText('Email'), { target: { value: 'wrong' } });
      fireEvent.click(within(panel).getByRole('button', { name: 'Save details' }));

      expect(await within(panel).findByText('Enter a valid email address.')).toBeTruthy();
      expect(within(panel).getByLabelText<HTMLInputElement>('Email').value).toBe('wrong');
    });
  });

  it('shows his Leave state and the Record Leave form in the Leave status tab', async () => {
    render(<StudentsPage source={fakeSource().source} today="2026-11-03" />);
    const panel = await openSettings('Bina Rao');

    tab(panel, 'Leave status');

    expect(within(panel).getByText('In hostel')).toBeTruthy();
    expect(within(panel).getByLabelText<HTMLInputElement>('Out date').max).toBe('2026-11-03');
    expect(within(panel).getByRole('button', { name: 'Record Leave' })).toBeTruthy();
  });

  describe('Danger zone', () => {
    it('asks before it Deactivates, and Cancel changes nothing', async () => {
      const { source, state } = fakeSource();
      render(<StudentsPage source={source} />);
      const panel = await openSettings('Bina Rao');
      tab(panel, 'Danger zone');

      fireEvent.click(within(panel).getByRole('button', { name: 'Deactivate Bina Rao' }));
      fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }));

      expect(state.changes).toEqual([]);
      expect(within(panel).getByRole('button', { name: 'Deactivate Bina Rao' })).toBeTruthy();
    });

    it('Deactivates once confirmed and takes him off the list', async () => {
      const { source, state } = fakeSource();
      render(<StudentsPage source={source} />);
      const panel = await openSettings('Bina Rao');
      tab(panel, 'Danger zone');

      fireEvent.click(within(panel).getByRole('button', { name: 'Deactivate Bina Rao' }));
      fireEvent.click(within(panel).getByRole('button', { name: 'Yes, Deactivate' }));

      expect(await screen.findByText('Deactivated Bina Rao.')).toBeTruthy();
      expect(state.changes).toEqual(['Deactivate 9002']);
      expect(names()).toEqual(['Asha Rao']);
    });

    it('Activates a Deactivated Student once confirmed', async () => {
      const { source, state } = fakeSource();
      state.students = [student('9002', 'Bina Rao', '201', false)];
      render(<StudentsPage source={source} />);
      fireEvent.click(await screen.findByLabelText('Show Deactivated'));
      const panel = await openSettings('Bina Rao');
      tab(panel, 'Danger zone');

      fireEvent.click(within(panel).getByRole('button', { name: 'Activate Bina Rao' }));
      fireEvent.click(within(panel).getByRole('button', { name: 'Yes, Activate' }));

      expect(await screen.findByText('Activated Bina Rao.')).toBeTruthy();
      expect(state.changes).toEqual(['Activate 9002']);
    });
  });
});

describe('filter and sort', () => {
  const threeStudents = () => {
    const fake = fakeSource();
    fake.state.students = [...STUDENTS, student('9003', 'Arjun Shah', '205')];
    return fake;
  };
  const openFilter = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Filter and sort' }));
    return screen.getByRole('dialog', { name: 'Filter and sort' });
  };

  it('offers only the floors that have Students', async () => {
    render(<StudentsPage source={threeStudents().source} />);

    const panel = await openFilter();

    const floors = within(within(panel).getByRole('group', { name: 'Floor' })).getAllByRole(
      'button',
    );
    expect(floors.map((one) => one.textContent)).toEqual(['All floors', 'Floor 1', 'Floor 2']);
  });

  it('shows only the Students on the chosen floor', async () => {
    render(<StudentsPage source={threeStudents().source} />);
    const panel = await openFilter();

    fireEvent.click(within(panel).getByRole('button', { name: 'Floor 2' }));

    expect(names()).toEqual(['Bina Rao', 'Arjun Shah']);
    expect(screen.getByText('Showing 2 of 3 Active Students on floor 2')).toBeTruthy();
  });

  it('sorts by name in alphabetical order', async () => {
    render(<StudentsPage source={threeStudents().source} />);
    const panel = await openFilter();

    fireEvent.click(within(panel).getByRole('button', { name: 'Name A to Z' }));

    expect(names()).toEqual(['Arjun Shah', 'Asha Rao', 'Bina Rao']);
  });

  it('keeps the floor and the search together', async () => {
    render(<StudentsPage source={threeStudents().source} />);
    const panel = await openFilter();
    fireEvent.click(within(panel).getByRole('button', { name: 'Floor 2' }));

    type('Search by name, Student ID or room', 'arjun');

    expect(names()).toEqual(['Arjun Shah']);
  });

  it('marks the button while a filter or sort is on', async () => {
    render(<StudentsPage source={threeStudents().source} />);
    const panel = await openFilter();

    fireEvent.click(within(panel).getByRole('button', { name: 'Floor 1' }));

    expect(screen.getByRole('button', { name: 'Filter and sort, on' })).toBeTruthy();
  });

  it('closes with Escape', async () => {
    render(<StudentsPage source={threeStudents().source} />);
    const panel = await openFilter();

    fireEvent.keyDown(panel, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Filter and sort' })).toBeNull();
  });
});
