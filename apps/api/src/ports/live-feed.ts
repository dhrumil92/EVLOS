// Tells whoever is watching the live view that new Punches have been stored.
export interface LiveFeed {
  punchesChanged(): void;
}
