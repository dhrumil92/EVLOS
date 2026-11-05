// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DeviceLastSeen } from './DeviceLastSeen.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const AT_2259_IST = Date.UTC(2026, 10, 5, 22, 59) - IST_OFFSET_MS;

afterEach(cleanup);

describe('Device Last Seen', () => {
  it('shows when the Device was last in touch', () => {
    render(<DeviceLastSeen status={{ lastSeenAt: AT_2259_IST, isQuiet: false }} />);

    expect(screen.getByText('Device last seen 5 Nov, 22:59.')).toBeTruthy();
  });

  it('warns when the Device has gone quiet, as Punches may still be on it', () => {
    render(<DeviceLastSeen status={{ lastSeenAt: AT_2259_IST, isQuiet: true }} />);

    expect(
      screen.getByText(
        'Device last seen 5 Nov, 22:59. Punches made since then may still be on it: ' +
          'check its power and Wi-Fi.',
      ),
    ).toBeTruthy();
  });

  it('warns when the Device has never been in touch', () => {
    render(<DeviceLastSeen status={{ lastSeenAt: null, isQuiet: true }} />);

    expect(
      screen.getByText(
        'The Device has not been in touch yet: check its power, its Wi-Fi and its Cloud ' +
          'server setting.',
      ),
    ).toBeTruthy();
  });

  it('shows nothing while the Last Seen is not known', () => {
    const { container } = render(<DeviceLastSeen status={null} />);

    expect(container.textContent).toBe('');
  });
});
