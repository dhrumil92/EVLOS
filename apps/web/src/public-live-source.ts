// The Public Live View (FR-17): numbers only, from the public server, with no login.
export interface PublicLiveView {
  day: string;
  // Students Present today.
  present: number;
  // Students expected at Pooja today: Active, and not Not Applicable.
  expected: number;
  // How many Students made their first Punch in each 15-minute bar of the Pooja Window.
  slots: number[];
  // When the server worked these out.
  updatedAt: number;
}

export interface PublicLiveSource {
  load(): Promise<PublicLiveView>;
}

export const httpPublicLiveSource: PublicLiveSource = {
  async load() {
    // credentials: 'omit', so the Rector's login cookie is never sent to the public route.
    const reply = await fetch('/api/public/live', { credentials: 'omit' });
    if (!reply.ok) throw new Error(`The server answered ${String(reply.status)}`);
    return (await reply.json()) as PublicLiveView;
  },
};
