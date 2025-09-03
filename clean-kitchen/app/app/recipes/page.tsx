import AuthGate from "@/components/auth-gate";
import { Card } from "@/components/ui/card";

export default function RecipesPage() {
  return (
    <AuthGate>
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-xl font-bold">Recipes</h1>
      </div>
      <Card>Te būs “Pagatavojams tagad” un filtri (laiks, grūtība, uzturs)</Card>
    </AuthGate>
  );
}
