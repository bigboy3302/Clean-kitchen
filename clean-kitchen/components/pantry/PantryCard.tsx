"use client";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Timestamp } from "firebase/firestore";

type FireDate =
  | Timestamp
  | Date
  | { seconds: number; nanoseconds?: number }
  | string
  | number
  | null
  | undefined;

type Props = {
  item: {
    id: string;
    name: string;
    quantity: number;
    createdAt?: FireDate;
    expiresAt?: FireDate;
  };
  onDelete: () => void;
};

function toDateSafe(v: FireDate): Date | undefined {
  if (!v) return undefined;

  // Firestore Timestamp instance
  if (v instanceof Timestamp) return v.toDate();

  // JS Date instance
  if (v instanceof Date) return v;

  // Firestore-like POJO
  if (typeof v === "object" && "seconds" in v && typeof v.seconds === "number") {
    return new Date(v.seconds * 1000);
  }

  // ISO string or ms since epoch
  if (typeof v === "string") {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return new Date(t);
  }
  if (typeof v === "number") {
    // assume ms epoch
    return new Date(v);
  }

  return undefined;
}

function fmt(v: FireDate) {
  const d = toDateSafe(v);
  return d ? d.toLocaleDateString() : "—";
}

export default function PantryCard({ item, onDelete }: Props) {
  return (
    <Card>
      <div className="root">
        <div className="main">
          <div className="title">{item.name}</div>
          <div className="meta">
            <span>
              Qty: <strong>{item.quantity}</strong>
            </span>
            <span>
              Expiry: <strong>{fmt(item.expiresAt)}</strong>
            </span>
          </div>
        </div>
        <div className="actions">
          <Button variant="secondary" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      <style jsx>{`
        .root {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .main {
          min-width: 0;
        }
        .title {
          font-weight: 600;
          color: #111827;
          margin-bottom: 6px;
        }
        .meta {
          display: flex;
          gap: 16px;
          color: #6b7280;
          font-size: 13px;
        }
        .actions {
          display: flex;
          gap: 8px;
        }
      `}</style>
    </Card>
  );
}
