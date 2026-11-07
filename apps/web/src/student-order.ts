// numeric: true puts room A-9 before A-10.
const byText = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

interface Placed {
  room: string;
  name: string;
}

export const byRoom = (a: Placed, b: Placed) =>
  byText.compare(a.room, b.room) || byText.compare(a.name, b.name);

export const byName = (a: Placed, b: Placed) =>
  byText.compare(a.name, b.name) || byText.compare(a.room, b.room);
