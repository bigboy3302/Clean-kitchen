"use client";

export type Workout = {
  id: string;
  title: string;
  level: "beginner" | "intermediate" | "advanced";
  daysPerWeek: number;
  focus: string; 
  notes?: string;
};

export default function WorkoutCard({ w }: { w: Workout }) {
  const badge =
    w.level === "beginner" ? "bg-green-100 text-green-700" :
    w.level === "intermediate" ? "bg-yellow-100 text-yellow-700" :
    "bg-purple-100 text-purple-700";

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{w.title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs ${badge}`}>{w.level}</span>
      </div>
      <p className="mt-1 text-sm text-gray-600">{w.focus} • {w.daysPerWeek}d/week</p>
      {w.notes && <p className="mt-2 text-sm text-gray-500">{w.notes}</p>}
    </div>
  );
}
