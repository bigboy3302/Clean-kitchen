import AuthGate from "@/components/auth-gate";
import PantryCard from "@/components/pantry/pantry-card";
import { Card } from "@/components/ui/card";

const mock = [
  { id:"1", name:"Piens 1L", quantity:{amount:1,unit:"gab"}, addedAt:new Date().toISOString(), expiryDate:new Date(Date.now()+2*86400000).toISOString() },
  { id:"2", name:"Āboli", quantity:{amount:6,unit:"gab"}, addedAt:new Date().toISOString() },
];

export default function PantryPage() {
  return (
    <AuthGate>
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-xl font-bold">Pantry</h1>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {mock.map(i => <PantryCard key={i.id} item={i as any} />)}
      </div>
      <Card className="mt-4">
        <h2 className="font-semibold mb-2">Ātrā skenēšana</h2>
        <p className="text-sm opacity-70">Kameras skeneris tiks pievienots.</p>
      </Card>
    </AuthGate>
  );
}
