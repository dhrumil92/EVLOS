// Runs before each web test file. jsdom has no layout and no scrollIntoView, so a page that
// scrolls to something it opened would fail in a test. A test that wants to see the call
// replaces this with its own vi.fn().
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = () => undefined;
}
