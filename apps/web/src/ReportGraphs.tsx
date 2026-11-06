import { useState } from 'react';
import type { ReactNode } from 'react';
import type { DayTotals } from './report-source.js';

const HEIGHT = 290;
const LEFT = 42;
const RIGHT = 8;
const TOP = 18;
const BOTTOM = 30;
const BASELINE = HEIGHT - BOTTOM;

const yOf = (value: number, max: number) => TOP + (1 - value / max) * (BASELINE - TOP);
const twoDigits = (value: number) => String(value).padStart(2, '0');
const hourLabel = (hour: number) => (hour === 5 ? '05:30' : `${twoDigits(hour)}:00`);
const hourName = (hour: number) => `${hourLabel(hour)} to ${twoDigits(hour + 1)}:00`;

interface Tip {
  text: string;
  x: number;
  y: number;
}

function Bar(props: { x: number; width: number; value: number; max: number; color: string }) {
  const { x, width, value, max, color } = props;
  if (value <= 0) return null;
  const y = yOf(value, max);
  const r = Math.min(3, width / 2, BASELINE - y);
  const top = `V${String(y + r)}Q${String(x)} ${String(y)} ${String(x + r)} ${String(y)}`;
  const side = `H${String(x + width - r)}Q${String(x + width)} ${String(y)} ${String(x + width)} ${String(y + r)}`;
  return (
    <path fill={color} d={`M${String(x)} ${String(BASELINE)}${top}${side}V${String(BASELINE)}Z`} />
  );
}

function Axis({ width, ticks, max }: { width: number; ticks: number[]; max: number }) {
  return (
    <>
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            className="plot-line"
            x1={LEFT}
            x2={width - RIGHT}
            y1={yOf(tick, max)}
            y2={yOf(tick, max)}
          />
          <text className="plot-tick" x={LEFT - 6} y={yOf(tick, max) + 4} textAnchor="end">
            {tick}
          </text>
        </g>
      ))}
      <line className="plot-base" x1={LEFT} x2={width - RIGHT} y1={BASELINE} y2={BASELINE} />
    </>
  );
}

// One plot with its hover note; a band covers each group so a thin bar is easy to reach.
function Plot(props: {
  width: number;
  label: string;
  wide?: boolean;
  children: (showTip: (text: string) => Record<string, unknown>) => ReactNode;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const showTip = (text: string) => ({
    onPointerMove: (event: React.PointerEvent) => {
      setTip({ text, x: event.clientX, y: event.clientY });
    },
    onPointerLeave: () => {
      setTip(null);
    },
  });
  return (
    <div className={props.wide ? 'plot plot-wide' : 'plot'}>
      <svg
        viewBox={`0 0 ${String(props.width)} ${String(HEIGHT)}`}
        role="img"
        aria-label={props.label}
      >
        {props.children(showTip)}
      </svg>
      {tip && (
        <div className="plot-tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

export function HourGraph({ hours }: { hours: number[] }) {
  const width = 900;
  const peak = Math.max(...hours, 1);
  const max = Math.ceil(peak / 20) * 20;
  const ticks = [0, 1, 2, 3, 4].map((part) => (max * part) / 4);
  const step = (width - LEFT - RIGHT) / hours.length;
  const barWidth = step - 14;
  return (
    <>
      <h2 className="font-display text-2xl font-semibold">Students by hour</h2>
      <p className="mb-2 text-muted">
        How many Students made their first Punch in each hour of the Pooja Window.
      </p>
      <Plot width={width} label="Students by hour of first Punch">
        {(showTip) => (
          <>
            <Axis width={width} ticks={ticks} max={max} />
            {hours.map((count, index) => {
              const hour = 5 + index;
              const x = LEFT + index * step + 7;
              return (
                <g key={hour}>
                  <Bar x={x} width={barWidth} value={count} max={max} color="var(--bar-present)" />
                  {count === peak && (
                    <text className="plot-peak" x={x + barWidth / 2} y={yOf(count, max) - 6}>
                      {count}
                    </text>
                  )}
                  <text
                    className="plot-tick"
                    x={x + barWidth / 2}
                    y={BASELINE + 18}
                    textAnchor="middle"
                  >
                    {hourLabel(hour)}
                  </text>
                  <rect
                    className="plot-band"
                    x={x - 7}
                    y={TOP}
                    width={step}
                    height={BASELINE - TOP}
                    {...showTip(`${hourName(hour)}: ${String(count)} Students`)}
                  />
                </g>
              );
            })}
          </>
        )}
      </Plot>
    </>
  );
}

const SERIES = [
  { name: 'Present', color: 'var(--bar-present)' },
  { name: 'Absent', color: 'var(--bar-absent)' },
  { name: 'Not Applicable', color: 'var(--bar-not-applicable)' },
];

export function MonthGraph({ days }: { days: DayTotals[] }) {
  const width = 1240;
  const max = 360;
  const step = (width - LEFT - RIGHT) / Math.max(days.length, 31);
  const barWidth = (step - 10) / 3;
  return (
    <>
      <h2 className="font-display text-2xl font-semibold">Every Day of the month</h2>
      <p className="mb-2 text-muted">Hover over a Day to see its numbers.</p>
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1">
        {SERIES.map((series) => (
          <span key={series.name} className="inline-flex items-center gap-1.5">
            <i className="inline-block size-3 rounded-[3px]" style={{ background: series.color }} />
            {series.name}
          </span>
        ))}
      </div>
      <Plot width={width} label="Present, Absent and Not Applicable for each Day" wide>
        {(showTip) => (
          <>
            <Axis width={width} ticks={[0, 90, 180, 270, 360]} max={max} />
            {days.map((totals, index) => {
              const x = LEFT + index * step + 4;
              const values = [totals.present, totals.absent, totals.notApplicable];
              return (
                <g key={totals.day}>
                  {SERIES.map((series, position) => (
                    <Bar
                      key={series.name}
                      x={x + position * barWidth}
                      width={barWidth - 1}
                      value={values[position] ?? 0}
                      max={max}
                      color={series.color}
                    />
                  ))}
                  <text
                    className="plot-tick"
                    x={x + (3 * barWidth) / 2}
                    y={BASELINE + 18}
                    textAnchor="middle"
                  >
                    {totals.day}
                  </text>
                  <rect
                    className="plot-band"
                    x={LEFT + index * step}
                    y={TOP}
                    width={step}
                    height={BASELINE - TOP}
                    {...showTip(
                      `Day ${String(totals.day)}: Present ${String(totals.present)}, Absent ${String(totals.absent)}, Not Applicable ${String(totals.notApplicable)}`,
                    )}
                  />
                </g>
              );
            })}
          </>
        )}
      </Plot>
    </>
  );
}
