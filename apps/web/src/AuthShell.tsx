import type { ReactNode } from 'react';

// The Pooja Window as the sun's path: the Day starts at 05:30 and ends at 18:00.
function SunPath() {
  return (
    <svg
      viewBox="0 0 520 220"
      role="img"
      aria-label="The Pooja Window drawn as the sun's path from 05:30 to 18:00"
      className="h-auto w-full text-primary"
    >
      <path
        d="M30 190 Q260 -40 490 190"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="2 8"
        strokeLinecap="round"
      />
      <path
        d="M30 190 Q118 60 172 72"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="172" cy="72" r="22" className="fill-now-wash stroke-focus" strokeWidth="3" />
      <line x1="10" y1="190" x2="510" y2="190" stroke="currentColor" strokeWidth="2" />
      <circle cx="30" cy="190" r="6" fill="currentColor" />
      <circle
        cx="490"
        cy="190"
        r="6"
        className="fill-surface"
        stroke="currentColor"
        strokeWidth="2"
      />
      <text x="30" y="214" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">
        05:30
      </text>
      <text x="490" y="214" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">
        18:00
      </text>
    </svg>
  );
}

// An answer in a box with an icon: a problem in red, or good news in green.
export function AuthAlert(props: { isProblem: boolean; title: string; hint?: string | undefined }) {
  const look = props.isProblem
    ? 'border-danger-line bg-danger-wash text-danger'
    : 'border-ok-line bg-ok-wash text-ok';
  return (
    <div
      role={props.isProblem ? 'alert' : 'status'}
      className={`flex gap-2.5 rounded-2xl border-[1.5px] px-3.5 py-3 ${look}`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mt-0.5 flex-none"
      >
        {props.isProblem ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 16.5v.5" />
          </>
        ) : (
          <>
            <path d="M3 6h18v12H3z" />
            <path d="M3 7l9 6 9-6" />
          </>
        )}
      </svg>
      <span>
        <strong>{props.title}</strong>
        {props.hint !== undefined && (
          <>
            <br />
            {props.hint}
          </>
        )}
      </span>
    </div>
  );
}

// The title of a screen, with a line under it saying what it is for.
export function AuthTitle(props: { title: string; line: string }) {
  return (
    <div>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">{props.title}</h1>
      <p className="mt-1.5 text-muted">{props.line}</p>
    </div>
  );
}

// The page around Log in, Forgot password and Set a new password: a panel about EVLOS on a wide
// screen, and the form beside it. On a phone only a small "evlos" shows above the form.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="screen flex min-h-screen flex-wrap bg-page pb-0">
      <aside
        aria-label="About EVLOS"
        className="hidden flex-[1_1_32rem] flex-col justify-between gap-10 bg-panel px-[clamp(2rem,6vw,4.5rem)] py-[clamp(2rem,6vw,4.5rem)] lg:flex"
      >
        <span className="font-display text-3xl font-extrabold tracking-tight text-primary lowercase">
          EVLOS
        </span>
        <div className="grid max-w-[35rem] gap-7">
          <SunPath />
          <p className="font-display text-[clamp(2.1rem,4vw,3.25rem)] leading-[1.05] font-extrabold tracking-tight">
            Every Pooja Punch, from sunrise to the evening.
          </p>
          <p className="max-w-[46ch] text-lg text-muted">
            The Device sends each Punch here. You keep the Leaves, Finalize the Day, and the
            Students hear about it only after you do.
          </p>
        </div>
        <p className="text-sm text-muted">
          For the hostel Rector. Students do not need an account.
        </p>
      </aside>
      <main className="flex flex-[1_1_26rem] items-center justify-center px-[clamp(1rem,5vw,4rem)] py-[clamp(2rem,6vw,4.5rem)]">
        <div className="grid w-full max-w-[26rem] gap-6">
          <span className="font-display text-3xl font-extrabold tracking-tight text-primary lowercase lg:hidden">
            EVLOS
          </span>
          {children}
        </div>
      </main>
    </div>
  );
}
