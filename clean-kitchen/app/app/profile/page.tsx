import AuthGate from "@/components/auth-gate";
import { Card } from "@/components/ui/card";

export default function ProfilePage() {
  return (
    <AuthGate>
      <Card>
        <h1 className="text-xl font-bold mb-2">Profils</h1>
        <p>Te nāks profila iestatījumi, mājsaimniecības dalīšana utt.</p>
      </Card>
    </AuthGate>
  );
}
