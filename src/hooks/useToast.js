import { useCallback, useMemo, useState } from 'react';

export function useToast() {
  const [list, setList] = useState([]);
  
  const add = useCallback((msg, type = "ok") => {
    const id = Date.now() + Math.random();
    setList(l => [...l, {id, msg, type}]);
    setTimeout(() => setList(l => l.filter(x => x.id !== id)), 3800);
  }, []);
  
  const ok = useCallback((m) => add(m, "ok"), [add]);
  const err = useCallback((m) => add(m, "err"), [add]);

  return useMemo(() => ({ list, ok, err }), [list, ok, err]);
}
