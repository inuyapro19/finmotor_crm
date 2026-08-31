export default function LeadsLoading() {
  return (
    <div className="animate-pulse space-y-3" aria-label="Cargando solicitudes">
      <div className="h-14 rounded-[var(--radius)] bg-[var(--muted)]" />
      <div className="h-10 rounded-[var(--radius)] bg-[var(--muted)]" />
      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-white">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-20 border-b border-[var(--border)] last:border-b-0" />
        ))}
      </div>
    </div>
  );
}
