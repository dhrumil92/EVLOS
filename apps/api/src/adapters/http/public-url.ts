// The address of the page a password reset link opens, built from PUBLIC_URL: the address
// the Rector types to reach EVLOS (http://localhost:5173 on this machine, the HTTPS address
// on the VM). Null when PUBLIC_URL is not set; then no reset link is sent. A wrong value
// stops the server at start.
export function resetPageUrlFrom(env: Record<string, string | undefined>): string | null {
  const base = (env.PUBLIC_URL ?? '').trim().replace(/\/$/, '');
  if (base === '') return null;
  if (!/^https?:\/\/\S+$/.test(base)) {
    throw new Error('PUBLIC_URL must start with http:// or https://. Check .env.');
  }
  return `${base}/reset-password`;
}
