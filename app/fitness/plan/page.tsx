"use client";

import { useEffect, useState, FormEvent } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Link from "next/link";

type Metrics = {
  height?: number; // cm
  weight?: number; // kg
  age?: number;
  sex?: "male" | "female";
  activity?: "sedentary"|"light"|"moderate"|"active"|"very";
  goal?: "bulk"|"cut"|"maintain";
  updatedAt?: any;
};

function calcTDEE({weight=0,height=0,age=0,sex="male",activity="light"}: Metrics){
  const s = sex==="male" ? 5 : -161;
  const bmr = (10*weight)+(6.25*height)-(5*age)+s;
  const mult = activity==="sedentary"?1.2: activity==="light"?1.375: activity==="moderate"?1.55: activity==="active"?1.725: 1.9;
  return Math.max(1200, Math.round(bmr*mult));
}

export default function FitnessPlanPage(){
  const [userId,setUserId]=useState<string|null>(null);
  const [metrics,setMetrics]=useState<Metrics|null>(null);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(false);
  const [msg,setMsg]=useState<string|null>(null);

  const [height,setHeight]=useState<string>("");
  const [weight,setWeight]=useState<string>("");
  const [age,setAge]=useState<string>("");
  const [sex,setSex]=useState<"male"|"female">("male");
  const [activity,setActivity]=useState<Metrics["activity"]>("light");
  const [goal,setGoal]=useState<Metrics["goal"]>("maintain");

  useEffect(()=>{
    const u = auth.currentUser;
    if(!u){ setLoading(false); setUserId(null); return; }
    setUserId(u.uid);
    (async ()=>{
      const ref = doc(db,"users",u.uid);
      const snap = await getDoc(ref);
      if (snap.exists()){
        const d = snap.data() as any;
        const m: Metrics = {
          height: d.height, weight: d.weight, age: d.age,
          sex: d.sex, activity: d.activity, goal: d.goal
        };
        setMetrics(m);
        if (!m.height || !m.weight || !m.age || !m.sex || !m.activity || !m.goal) {
          setHeight((m.height ?? "").toString());
          setWeight((m.weight ?? "").toString());
          setAge((m.age ?? "").toString());
          setSex((m.sex ?? "male"));
          setActivity((m.activity ?? "light"));
          setGoal((m.goal ?? "maintain"));
          setEditing(true);
        }
      } else {
        setEditing(true);
      }
      setLoading(false);
    })();
  },[]);

  async function save(e:FormEvent){
    e.preventDefault();
    if(!userId) return;
    const payload: Metrics = {
      height: Number(height), weight: Number(weight), age: Number(age),
      sex, activity, goal, updatedAt: serverTimestamp()
    };
    const ref = doc(db,"users",userId);
    await setDoc(ref, payload, {merge:true});
    setMetrics(payload);
    setEditing(false);
    setMsg("Dati saglabāti.");
  }

  if (loading) return <p>Ielādē…</p>;


  if(!userId){
    return (
      <div className="card card--pad">
        <h2 className="card__title">Nepieciešama autorizācija</h2>
        <p className="card__sub">Lai izveidotu personalizētu plānu, lūdzu <Link href="/auth/login">ielogojies</Link> vai <Link href="/auth/register">reģistrējies</Link>.</p>
      </div>
    );
  }


  if (editing){
    return (
      <div className="card card--pad">
        <h2 className="card__title">Tavi dati</h2>
        <form onSubmit={save} className="grid form-row form-2">
          <Input label="Augums (cm)" value={height} onChange={e=>setHeight((e.target as HTMLInputElement).value)} required />
          <Input label="Svars (kg)" value={weight} onChange={e=>setWeight((e.target as HTMLInputElement).value)} required />
          <Input label="Vecums" value={age} onChange={e=>setAge((e.target as HTMLInputElement).value)} required />

          <div>
            <label className="label">Dzimums</label>
            <select className="input" value={sex} onChange={e=>setSex(e.target.value as any)}>
              <option value="male">Vīrietis</option>
              <option value="female">Sieviete</option>
            </select>
          </div>

          <div>
            <label className="label">Aktivitāte</label>
            <select className="input" value={activity} onChange={e=>setActivity(e.target.value as any)}>
              <option value="sedentary">Sēdošs</option>
              <option value="light">Viegls</option>
              <option value="moderate">Mērens</option>
              <option value="active">Aktīvs</option>
              <option value="very">Ļoti aktīvs</option>
            </select>
          </div>

          <div>
            <label className="label">Mērķis</label>
            <select className="input" value={goal} onChange={e=>setGoal(e.target.value as any)}>
              <option value="maintain">Uzturēt</option>
              <option value="bulk">Uzsvara pieaugums (bulk)</option>
              <option value="cut">Samazināt (cut)</option>
            </select>
          </div>

          <div className="right mt-2">
            <Button style={{width:200}}>Saglabāt</Button>
          </div>
        </form>
      </div>
    );
  }


  const tdee = calcTDEE(metrics ?? {});
  const cal = metrics?.goal==="bulk" ? tdee+250 : metrics?.goal==="cut" ? tdee-300 : tdee;
  const protein = Math.round((metrics?.weight ?? 0)*2); // g
  const fat = Math.round((metrics?.weight ?? 0)*0.8);  // g
  const carbs = Math.max(0, Math.round((cal - (protein*4) - (fat*9))/4));

  return (
    <div className="grid" style={{gap:16}}>
      {msg && <div className="card card--pad"><p className="card__sub">{msg}</p></div>}

      <div className="card card--pad">
        <div className="flex items-center gap-3">
          <h2 className="card__title">Tavs plāns</h2>
          <span className="badge">{metrics?.goal?.toUpperCase()}</span>
        </div>
        <p className="card__sub">Balstīts uz taviem datiem, neviens “basic bulking/cutting” viesiem netiek rādīts.</p>

        <div className="grid grid-3 mt-3">
          <div className="card card--pad">
            <h3 className="card__title">Kalorijas</h3>
            <p className="card__sub">{cal} kcal / dienā</p>
          </div>
          <div className="card card--pad">
            <h3 className="card__title">Olbaltumvielas</h3>
            <p className="card__sub">{protein} g</p>
          </div>
          <div className="card card--pad">
            <h3 className="card__title">Tauki / Ogļhidrāti</h3>
            <p className="card__sub">{fat} g tauki · {carbs} g ogļh.</p>
          </div>
        </div>

        <div className="mt-3">
          <Button variant="secondary" onClick={()=>setEditing(true)} style={{width:220}}>
            Rediģēt manus datus
          </Button>
        </div>
      </div>

      <div className="card card--pad">
        <h3 className="card__title">Treniņu ieteikumi</h3>
        <ul className="card__sub">
          <li>3–4 spēka treniņi nedēļā (pilna ķermeņa / push-pull-legs)</li>
          <li>Bulk: 6–10 atkārtojumi pamatvingrinājumos, progresīva pārslodze</li>
          <li>Cut: 8–12 atkārtojumi, saglabā darba svarus, pievieno 1–2 kardio sesijas</li>
        </ul>
      </div>
    </div>
  );
}
