// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReportRequest, ReportSource } from './report-source.js';
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

const student = (
  studentId: string,
  name: string,
  room: string,
  isActive = true,
  leaveState: LeaveState = 'In hostel',
): ListedStudent => ({
  studentId,
  name,
  room,
  email: `${studentId}@example.com`,
  phone: null,
  isActive,
  floor: Number(room.charAt(0)),
  leaveState,
  openLeave: null,
});

const STUDENTS = [student('9002', 'Bina Rao', '201'), student('9001', 'Asha Rao', '109')];

function fakeSource(answer?: AddResult, failing = false) {
  const state = {
    students: [...STUDENTS],
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

// Bina Rao has a month of Pooja Statuses; every other Student has none.
function fakeReports() {
  const asked: ReportRequest[] = [];
  const reports: ReportSource = {
    load: (request) => {
      asked.push(request);
      return Promise.resolve({
        title: 'A month',
        isFinalized: false,
        reportDays: [],
        rows: [
          {
            studentId: '9002',
            name: 'Bina Rao',
            room: '201',
            statuses: ['Present', 'Absent', 'Not Applicable'],
          },
        ],
      });
    },
    csvUrl: () => '',
    xlsxUrl: () => '',
  };
  return { reports, asked };
}

function show(source: StudentSource, today?: string, reports = fakeReports().reports) {
  const opened: [string, readonly string[]][] = [];
  render(
    <StudentsPage
      source={source}
      reports={reports}
      today={today ?? '2026-11-03'}
      onOpenLeaves={(book, students) => {
        opened.push([book, students]);
      }}
    />,
  );
  return opened;
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
const rows = () =>
  within(screen.getByRole('table', { name: 'Student list' }))
    .getAllByRole('row')
    .slice(1);
const names = () => rows().map((row) => within(row).getByRole('button').textContent);
const rowOf = (name: string) =>
  rows().find((row) => within(row).getByRole('button').textContent === name) as HTMLElement;
// The filters and the floor and sort are in menus: open one, then use what is inside.
const openMenu = (name: RegExp | string) => {
  fireEvent.click(screen.getByRole('button', { name }));
};
const group = (name: RegExp) => {
  openMenu(/^Filter:/);
  fireEvent.click(screen.getByRole('button', { name }));
};

afterEach(cleanup);

describe('Students page', () => {
  it('lists the Students by room in ascending order', async () => {
    show(fakeSource().source);
    await screen.findByText('Bina Rao');

    expect(names()).toEqual(['Asha Rao', 'Bina Rao']);
  });

  it('shows the Email and Phone of each Student, with Room first', async () => {
    show(fakeSource().source);
    await screen.findByText('Bina Rao');

    const cells = within(rowOf('Bina Rao')).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual([
      '',
      '201',
      expect.stringContaining('Bina Rao') as string,
      '9002@example.com',
      '–',
    ]);
  });

  it('shows how many Students there are', async () => {
    show(fakeSource().source);

    expect(await screen.findByText('Showing 2 of 2 Active Students')).toBeTruthy();
  });

  it.each([
    ['name', 'bina'],
    ['Student ID', '9002'],
    ['room', '201'],
  ])('finds a Student by %s', async (_kind, search) => {
    show(fakeSource().source);
    await screen.findByText('Bina Rao');

    type('Search by name, Student ID or room', search);

    expect(names()).toEqual(['Bina Rao']);
  });

  it('says so when no Student matches the search', async () => {
    show(fakeSource().source);
    await screen.findByText('Bina Rao');

    type('Search by name, Student ID or room', 'nobody');

    expect(screen.getByText(/No Student matches this search/)).toBeTruthy();
  });

  it('invites the Rector to add the first Student when there are none', async () => {
    const { source, state } = fakeSource();
    state.students = [];

    show(source);

    expect(await screen.findByText(/No Students yet/)).toBeTruthy();
  });

  it('adds a Student and shows the new Student in the list without a reload', async () => {
    const { source, state } = fakeSource();
    show(source);
    await openForm();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save Student' }));

    expect(await screen.findByText('Added Chitra Rao.')).toBeTruthy();
    expect(screen.getByText('Showing 3 of 3 Active Students')).toBeTruthy();
    expect(state.forms[0]).toMatchObject({ studentId: '9003', phone: '' });
  });

  it('keeps what was typed and marks the field when it is invalid', async () => {
    show(fakeSource({ outcome: 'invalid', fields: ['email'] }).source);
    await openForm();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save Student' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Chitra Rao');
  });

  it('explains that a Student ID is never reused', async () => {
    show(fakeSource({ outcome: 'student-id-used' }).source);
    await openForm();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save Student' }));

    expect(await screen.findByText(/already used. A Student ID is never reused/)).toBeTruthy();
  });

  it('says how to fix it when the server cannot be reached', async () => {
    show(fakeSource(undefined, true).source);

    expect(await screen.findByText(/Start it with npm run dev/)).toBeTruthy();
  });
});

describe('the filter buttons', () => {
  const mixed = () => {
    const fake = fakeSource();
    fake.state.students = [
      student('9001', 'Asha Rao', '109', true, 'Away'),
      student('9002', 'Bina Rao', '201', true, 'Due Back'),
      student('9003', 'Chitra Rao', '305'),
      student('9004', 'Deepa Rao', '110', false),
    ];
    return fake;
  };

  it('count the Students in each group', async () => {
    show(mixed().source);
    await screen.findByText('Bina Rao');

    openMenu(/^Filter:/);
    const buttons = within(screen.getByRole('group', { name: 'Filter' })).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'All Active 3',
      'In hostel 1',
      'Away 2',
      'Due Back 1',
      'Deactivated 1',
    ]);
  });

  it('mark Away and Due Back Students after the name, each with a text label (FR-6)', async () => {
    show(mixed().source);
    await screen.findByText('Bina Rao');

    expect(within(rowOf('Asha Rao')).getByText('Away')).toBeTruthy();
    expect(within(rowOf('Bina Rao')).getByText('Due Back')).toBeTruthy();
    expect(within(rowOf('Chitra Rao')).queryByText('In hostel')).toBeNull();
  });

  it('show only the Away Students, Due Back included, when Away is chosen', async () => {
    show(mixed().source);
    await screen.findByText('Bina Rao');

    group(/^Away/);

    expect(names()).toEqual(['Asha Rao', 'Bina Rao']);
    expect(screen.getByText('Showing 2 of 2 Away Students')).toBeTruthy();
  });

  it('list only Active Students at first', async () => {
    show(mixed().source);
    await screen.findByText('Bina Rao');

    expect(names()).not.toContain('Deepa Rao');
  });

  it('show only the Deactivated Students, marked as Deactivated, when asked', async () => {
    show(mixed().source);
    await screen.findByText('Bina Rao');

    group(/^Deactivated/);

    expect(names()).toEqual(['Deepa Rao']);
    expect(within(rowOf('Deepa Rao')).getByText('Deactivated')).toBeTruthy();
    expect(screen.getByText('Showing 1 of 1 Deactivated Students')).toBeTruthy();
  });

  it('say so when no Student is Deactivated', async () => {
    show(fakeSource().source);
    await screen.findByText('Bina Rao');

    group(/^Deactivated/);

    expect(screen.getByText('No Student is Deactivated.')).toBeTruthy();
  });
});

describe('the Filter and Floor and sort menus', () => {
  it('start closed, and show the chosen filter on the button', async () => {
    show(fakeSource().source);
    await screen.findByText('Bina Rao');

    expect(screen.queryByRole('group', { name: 'Filter' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Filter: All Active' })).toBeTruthy();
  });

  it('close after a filter is chosen, and the button names it', async () => {
    show(fakeSource().source);
    await screen.findByText('Bina Rao');

    group(/^Away/);

    expect(screen.queryByRole('group', { name: 'Filter' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Filter: Away' })).toBeTruthy();
  });

  it('close with Escape', async () => {
    show(fakeSource().source);
    await screen.findByText('Bina Rao');
    openMenu('Floor and sort');

    fireEvent.keyDown(screen.getByRole('group', { name: 'Floor and sort' }), { key: 'Escape' });

    expect(screen.queryByRole('group', { name: 'Floor and sort' })).toBeNull();
  });

  it('close when the page is pressed outside them', async () => {
    show(fakeSource().source);
    await screen.findByText('Bina Rao');
    openMenu(/^Filter:/);

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('group', { name: 'Filter' })).toBeNull();
  });

  it('stay out of the page while the list is empty', async () => {
    const { source, state } = fakeSource();
    state.students = [];
    show(source);

    await screen.findByText(/No Students yet/);

    expect(screen.queryByRole('button', { name: /^Filter:/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Vidyalaya Presence' })).toBeNull();
  });
});

describe('floor and sort', () => {
  const threeStudents = () => {
    const fake = fakeSource();
    fake.state.students = [...STUDENTS, student('9003', 'Arjun Shah', '205')];
    return fake;
  };

  it('offers only the floors that have Students', async () => {
    show(threeStudents().source);
    await screen.findByText('Bina Rao');

    openMenu('Floor and sort');
    const options = within(screen.getByLabelText('Floor')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'All floors',
      'Floor 1',
      'Floor 2',
    ]);
  });

  it('shows only the Students on the chosen floor', async () => {
    show(threeStudents().source);
    await screen.findByText('Bina Rao');

    openMenu('Floor and sort');
    type('Floor', '2');

    expect(names()).toEqual(['Bina Rao', 'Arjun Shah']);
    expect(screen.getByText('Showing 2 of 3 Active Students on floor 2')).toBeTruthy();
  });

  it('sorts by name in alphabetical order', async () => {
    show(threeStudents().source);
    await screen.findByText('Bina Rao');

    openMenu('Floor and sort');
    type('Sort by', 'Name A to Z');

    expect(names()).toEqual(['Arjun Shah', 'Asha Rao', 'Bina Rao']);
  });

  it('keeps the floor and the search together', async () => {
    show(threeStudents().source);
    await screen.findByText('Bina Rao');
    openMenu('Floor and sort');
    type('Floor', '2');

    type('Search by name, Student ID or room', 'arjun');

    expect(names()).toEqual(['Arjun Shah']);
  });
});

describe('ticking Students', () => {
  const withAway = () => {
    const fake = fakeSource();
    fake.state.students = [...STUDENTS, student('9003', 'Chitra Rao', '205', true, 'Away')];
    return fake;
  };

  it('shows a bar with what can be done for the ticked Students', async () => {
    show(withAway().source);
    await screen.findByText('Bina Rao');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Tick Bina Rao' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tick Chitra Rao' }));

    const bar = screen.getByRole('region', { name: 'Ticked Students' });
    expect(within(bar).getByText('2 Students ticked')).toBeTruthy();
    expect(within(bar).getByRole('button', { name: 'Record Leave for 1' })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: 'Record Return for 1' })).toBeTruthy();
  });

  it('opens the Going-to-Home Book with a line for each ticked Student in hostel', async () => {
    const opened = show(withAway().source);
    await screen.findByText('Bina Rao');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tick every Student shown' }));

    fireEvent.click(screen.getByRole('button', { name: 'Record Leave for 2' }));

    expect(opened).toEqual([['Going-to-Home Book', ['9001', '9002']]]);
  });

  it('opens the Back-from-Home Book with each ticked Away Student ticked there too', async () => {
    const opened = show(withAway().source);
    await screen.findByText('Bina Rao');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tick Chitra Rao' }));

    fireEvent.click(screen.getByRole('button', { name: 'Record Return for 1' }));

    expect(opened).toEqual([['Back-from-Home Book', ['9003']]]);
  });

  it('Clear unticks every Student and hides the bar', async () => {
    show(withAway().source);
    await screen.findByText('Bina Rao');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tick Bina Rao' }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.queryByRole('region', { name: 'Ticked Students' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Tick Bina Rao' })).toHaveProperty(
      'checked',
      false,
    );
  });
});

describe('the Student panel', () => {
  const openPanel = async (name: string) => {
    fireEvent.click(await screen.findByRole('button', { name }));
    return screen.getByRole('region', { name });
  };

  it('puts Filter and Floor and sort before Add a Student, on the row of the title', async () => {
    show(fakeSource().source);
    await screen.findByText('Bina Rao');
    const filter = screen.getByRole('button', { name: /^Filter:/ });
    const sort = screen.getByRole('button', { name: 'Floor and sort' });
    const add = screen.getByRole('button', { name: 'Add a Student' });

    expect(filter.compareDocumentPosition(sort) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sort.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Students' }).parentElement?.contains(add)).toBe(
      true,
    );
  });

  it('puts Vidyalaya Presence between Floor and sort and Add a Student', async () => {
    show(fakeSource().source);
    await screen.findByText('Bina Rao');
    const sort = screen.getByRole('button', { name: 'Floor and sort' });
    const presence = screen.getByRole('button', { name: 'Vidyalaya Presence' });
    const add = screen.getByRole('button', { name: 'Add a Student' });

    expect(sort.compareDocumentPosition(presence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(presence.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Students' }).parentElement?.contains(presence),
    ).toBe(true);
  });

  it('downloads Vidyalaya Presence for today, filled in, from the Students page', async () => {
    show(fakeSource().source, '2026-11-03');
    await screen.findByText('Bina Rao');

    fireEvent.click(screen.getByRole('button', { name: 'Vidyalaya Presence' }));

    expect(
      screen
        .getByRole('link', { name: 'Download Vidyalaya Presence as Excel' })
        .getAttribute('href'),
    ).toBe('/api/vidyalaya-presence/xlsx?view=Day&day=2026-11-03');
  });

  it('puts the search in the list card, with the panel beside the list', async () => {
    show(fakeSource().source);
    const list = await screen.findByRole('region', { name: 'Students' });

    const search = screen.getByRole('searchbox', { name: 'Search by name, Student ID or room' });

    expect(list.contains(search)).toBe(true);
    expect(
      list.parentElement?.contains(screen.getByRole('region', { name: 'Choose a Student' })),
    ).toBe(true);
    expect(screen.queryByRole('region', { name: 'Find and filter' })).toBeNull();
  });

  it('keeps its place beside the list, saying what will appear there, before a name is pressed', async () => {
    show(fakeSource().source);

    const place = await screen.findByRole('region', { name: 'Choose a Student' });

    expect(within(place).getByText(/Press a Student's name/)).toBeTruthy();
  });

  it('opens when the name is pressed, and closes with Close or Escape', async () => {
    show(fakeSource().source);

    const panel = await openPanel('Bina Rao');
    expect(within(panel).getByText('Room 201, Student ID 9002')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'Bina Rao' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Choose a Student' })).toBeTruthy();

    fireEvent.keyDown(await openPanel('Bina Rao'), { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Bina Rao' })).toBeNull();
  });

  it('opens when the row is pressed anywhere, such as on the Email', async () => {
    show(fakeSource().source);
    await screen.findByText('Bina Rao');

    fireEvent.click(within(rowOf('Bina Rao')).getByText('9002@example.com'));

    expect(screen.getByRole('region', { name: 'Bina Rao' })).toBeTruthy();
  });

  it('does not open when only the tick box is pressed', async () => {
    show(fakeSource().source);
    await screen.findByText('Bina Rao');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Tick Bina Rao' }));

    expect(screen.queryByRole('region', { name: 'Bina Rao' })).toBeNull();
    expect(screen.getByText('1 Student ticked')).toBeTruthy();
  });

  it('shows the Leave state and the Record Leave form', async () => {
    show(fakeSource().source, '2026-11-03');
    const panel = await openPanel('Bina Rao');

    expect(within(panel).getByText('In hostel')).toBeTruthy();
    expect(within(panel).getByLabelText<HTMLInputElement>('Out date').max).toBe('2026-11-03');
    expect(within(panel).getByRole('button', { name: 'Record Leave' })).toBeTruthy();
  });

  it("shows the Student's month of Pooja Statuses, between the name and the Leave box", async () => {
    show(fakeSource().source, '2026-11-03');
    const panel = await openPanel('Bina Rao');

    const month = await within(panel).findByRole('region', { name: 'Pooja Statuses in the month' });

    expect(within(month).getByLabelText('1 November: Present')).toBeTruthy();
    expect(within(month).getByLabelText('2 November: Absent')).toBeTruthy();
    expect(within(month).getByText('1 Present, 1 Absent, 1 Not Applicable')).toBeTruthy();
    const leave = within(panel).getByRole('heading', { name: 'Leave' });
    expect(month.compareDocumentPosition(leave) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      within(panel).getByRole('heading', { name: 'Bina Rao' }).compareDocumentPosition(month) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('asks for the month that holds today, and shows no Pooja Status of another Student', async () => {
    const { reports, asked } = fakeReports();
    show(fakeSource().source, '2026-11-03', reports);
    const panel = await openPanel('Asha Rao');

    expect(await within(panel).findByText('No Pooja Status for this month.')).toBeTruthy();
    expect(asked).toEqual([{ view: 'Month', month: '2026-11' }]);
  });

  describe('Details', () => {
    const editDetails = async (name: string) => {
      const panel = await openPanel(name);
      fireEvent.click(within(panel).getByRole('button', { name: 'Edit details' }));
      return panel;
    };

    it('shows the saved Email, Phone and Room', async () => {
      show(fakeSource().source);

      const panel = await openPanel('Bina Rao');

      expect(within(panel).getByText('9002@example.com')).toBeTruthy();
      expect(within(panel).getByText('201, Floor 2')).toBeTruthy();
    });

    it('starts from the saved details and cannot change the Student ID', async () => {
      show(fakeSource().source);

      const panel = await editDetails('Bina Rao');

      expect(within(panel).getByLabelText<HTMLInputElement>('Name').value).toBe('Bina Rao');
      expect(within(panel).queryByLabelText('Student ID')).toBeNull();
      expect(within(panel).getByText(/Student ID 9002 cannot be changed/)).toBeTruthy();
    });

    it('saves the edited details under the same Student ID', async () => {
      const { source, state } = fakeSource();
      show(source);
      const panel = await editDetails('Bina Rao');

      fireEvent.change(within(panel).getByLabelText('Room'), { target: { value: '404' } });
      fireEvent.click(within(panel).getByRole('button', { name: 'Save details' }));

      expect(await within(panel).findByText('Saved.')).toBeTruthy();
      expect(state.edits[0]).toEqual([
        '9002',
        { name: 'Bina Rao', room: '404', email: '9002@example.com', phone: '' },
      ]);
      expect(within(rowOf('Bina Rao')).getByText('404')).toBeTruthy();
    });

    it('keeps what was typed and marks the field when it is invalid', async () => {
      const { source, state } = fakeSource();
      state.editAnswer = { outcome: 'invalid', fields: ['email'] };
      show(source);
      const panel = await editDetails('Bina Rao');

      fireEvent.change(within(panel).getByLabelText('Email'), { target: { value: 'wrong' } });
      fireEvent.click(within(panel).getByRole('button', { name: 'Save details' }));

      expect(await within(panel).findByText('Enter a valid email address.')).toBeTruthy();
      expect(within(panel).getByLabelText<HTMLInputElement>('Email').value).toBe('wrong');
    });
  });

  describe('Deactivate and Activate', () => {
    it('asks before it Deactivates, and Cancel changes nothing', async () => {
      const { source, state } = fakeSource();
      show(source);
      const panel = await openPanel('Bina Rao');

      fireEvent.click(within(panel).getByRole('button', { name: 'Deactivate Bina Rao' }));
      fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }));

      expect(state.changes).toEqual([]);
      expect(within(panel).getByRole('button', { name: 'Deactivate Bina Rao' })).toBeTruthy();
    });

    it('Deactivates once confirmed and takes the Student off the list', async () => {
      const { source, state } = fakeSource();
      show(source);
      const panel = await openPanel('Bina Rao');

      fireEvent.click(within(panel).getByRole('button', { name: 'Deactivate Bina Rao' }));
      fireEvent.click(within(panel).getByRole('button', { name: 'Yes, Deactivate' }));

      expect(await screen.findByText('Deactivated Bina Rao.')).toBeTruthy();
      expect(state.changes).toEqual(['Deactivate 9002']);
      expect(names()).toEqual(['Asha Rao']);
    });

    it('Activates a Deactivated Student once confirmed', async () => {
      const { source, state } = fakeSource();
      state.students = [student('9002', 'Bina Rao', '201', false)];
      show(source);
      await screen.findByText('No Student is Active.');
      group(/^Deactivated/);
      const panel = await openPanel('Bina Rao');

      fireEvent.click(within(panel).getByRole('button', { name: 'Activate Bina Rao' }));
      fireEvent.click(within(panel).getByRole('button', { name: 'Yes, Activate' }));

      expect(await screen.findByText('Activated Bina Rao.')).toBeTruthy();
      expect(state.changes).toEqual(['Activate 9002']);
    });
  });
});
