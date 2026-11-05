// Asks for a new password on the command line without showing it, so it never appears on
// screen or in the shell history. Used by npm run rector:create and npm run rector:password.
import { Writable } from 'node:stream';
import { createInterface } from 'node:readline';

// The password, typed twice; null when the two differ. The lines are read in order from one
// queue, so the second answer is never lost, even when both arrive at once (piped input).
export async function askNewPassword(): Promise<string | null> {
  const silent = new Writable({
    write: (_chunk, _encoding, done) => {
      done();
    },
  });
  // Keyboard mode only at a real terminal; piped input is read as plain lines, and is not
  // shown on screen either way.
  const prompt = createInterface({
    input: process.stdin,
    output: silent,
    terminal: process.stdin.isTTY,
  });
  const lines = prompt[Symbol.asyncIterator]();
  const ask = async (question: string) => {
    process.stdout.write(question);
    const line = await lines.next();
    process.stdout.write('\n');
    return line.done ? '' : line.value;
  };
  try {
    const password = await ask('Password (at least 12 characters): ');
    return (await ask('Type it again: ')) === password ? password : null;
  } finally {
    prompt.close();
  }
}
