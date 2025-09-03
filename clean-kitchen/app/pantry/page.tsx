

export const metadata = { title: "Pantry" };
import AuthGate from "@/components/auth-gate";


export default function PantryPage() {
  return (
    <AuthGate>
      <section className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Pantry</h1>
        <p>Te būs tavas pārtikas preces.</p>
      </section>
    </AuthGate>
  );
}
