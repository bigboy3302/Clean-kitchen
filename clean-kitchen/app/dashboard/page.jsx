import AuthGate from "@/components/auth-gate";

export default function DashboardPage() {
  return (
    <AuthGate>
      <section className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
        <p>Laipni lūgts Clean-Kitchen!</p>
      </section>
    </AuthGate>
  );
}
