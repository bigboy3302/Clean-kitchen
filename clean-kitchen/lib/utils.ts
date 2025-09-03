export const cn = (...args: (string | undefined | null | false)[]) =>
  args.filter(Boolean).join(" ");

export const isExpiringSoon = (iso?: string, days = 3) => {
  if (!iso) return false;
  const now = new Date();
  const dt = new Date(iso);
  const diff = (dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= days;
};
