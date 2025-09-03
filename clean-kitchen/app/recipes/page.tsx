import AuthGate from "@/components/auth-gate";
export const metadata = { title: "Recipes" };


export default function RecipesPage() {
  return (
    <AuthGate>
      <section className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Recipes</h1>
        <p>Šeit būs receptes un ieteikumi.</p>
      </section>
    </AuthGate>
  );
}
