import { Card } from "@/components/ui/card";
import { PantryItem } from "@/lib/types";
import { isExpiringSoon } from "@/lib/utils";

export default function PantryCard({ item }: { item: PantryItem }) {
  const soon = isExpiringSoon(item.expiryDate);
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{item.name}</h3>
          <p className="text-sm opacity-70">
            {item.quantity.amount} {item.quantity.unit}
          </p>
          {item.expiryDate && (
            <p className={`text-sm ${soon ? "text-orange-600" : "opacity-70"}`}>
              Derīgs līdz: {new Date(item.expiryDate).toLocaleDateString()}
            </p>
          )}
        </div>
        {soon && <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">Izlietot drīz</span>}
      </div>
    </Card>
  );
}
