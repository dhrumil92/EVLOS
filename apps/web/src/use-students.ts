import { useCallback, useEffect, useState } from 'react';
import type { ListedStudent, StudentSource } from './student-source.js';

// The Student list, loaded once and again on refresh. Null until it first arrives; failed
// when the server cannot be reached, so the page can say how to fix it.
export function useStudents(source: StudentSource) {
  const [students, setStudents] = useState<ListedStudent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setStudents(await source.list());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [source]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { students, failed, refresh };
}
