// deterministic avatar color from player name
export function avatarColor(name) {
  const colors = [
    "#f43f5e", "#f97316", "#eab308",
    "#22c55e", "#3b82f6", "#6366f1",
    "#8b5cf6", "#ec4899"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
