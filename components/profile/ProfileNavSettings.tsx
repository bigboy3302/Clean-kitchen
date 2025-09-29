
import React from "react";
import { useNavPrefs } from "../nav/useNavPrefs"; 
import { db } from "@/lib/firebase";              

export default function ProfileNavSettings() {
  const { nav, save, loading, error } = useNavPrefs(db);

  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: "red" }}>Error: {(error as any)?.message}</p>;

  const handlePlacement = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await save({ placement: e.target.value as any });
  };

  const toggleCompact = async () => {
    await save({ compact: !nav?.compact });
  };

  const setOrder = async () => {
    await save({ order: ["dashboard", "pantry", "recipes"] });
  };

  return (
    <div>
      <h3>Nav Settings</h3>

      <label>
        Placement:&nbsp;
        <select value={nav?.placement ?? "header"} onChange={handlePlacement}>
          <option value="header">header</option>
          <option value="top">top</option>
          <option value="bottom">bottom</option>
          <option value="floating">floating</option>
        </select>
      </label>

      <div style={{ marginTop: 8 }}>
        <button onClick={toggleCompact}>{nav?.compact ? "Disable compact" : "Enable compact"}</button>
      </div>

      <div style={{ marginTop: 8 }}>
        <button onClick={setOrder}>Set sample order</button>
      </div>
    </div>
  );
}
