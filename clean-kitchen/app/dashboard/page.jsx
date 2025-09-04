// app/dashboard/page.tsx
import Card from "@/components/ui/Card";

export default function DashboardPage() {
  return (
    <div className="container">
      <h1>Dashboard</h1>
      <p>A quick snapshot of your pantry and ideas</p>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card>
          <h2>Pantry status</h2>
          <p>Your expiring items and low stock.</p>
        </Card>
        <Card>
          <h2>Recipe suggestions</h2>
          <p>Based on what you have.</p>
        </Card>
      </div>
    </div>
  );
}
