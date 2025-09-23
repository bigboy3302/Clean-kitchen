"use client";

export default function GoalHero({
  title,
  subtitle,
  macros,
}: {
  title: string;
  subtitle: string;
  macros: { calories: number; protein: number; carbs: number; fat: number };
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="rounded-2xl border bg-white/70 p-6 shadow-sm backdrop-blur">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-gray-600">{subtitle}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MacroChip label="Calories" value={`${macros.calories} kcal`} />
          <MacroChip label="Protein" value={`${macros.protein} g`} />
          <MacroChip label="Carbs" value={`${macros.carbs} g`} />
          <MacroChip label="Fat" value={`${macros.fat} g`} />
        </div>
      </div>
    </section>
  );
}

function MacroChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-4 py-3 text-sm">
      <div className="text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
