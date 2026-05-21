export const fmtPhone = v => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 1) return d ? "+7" : "";
  if (d.length <= 4) return `+7 (${d.slice(1)}`;
  if (d.length <= 7) return `+7 (${d.slice(1,4)}) ${d.slice(4)}`;
  if (d.length <= 9) return `+7 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return `+7 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7,9)}-${d.slice(9)}`;
};