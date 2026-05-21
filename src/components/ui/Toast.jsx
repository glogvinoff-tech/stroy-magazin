import React from 'react';
import { Icons } from '../icons/Icons';

export function Toast({ list }) {
  return (
    <div className="toast-wrap">
      {list.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === "ok" ? <Icons.Check /> : <Icons.XIcon />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}