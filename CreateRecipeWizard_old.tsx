function CreateRecipeWizard({
  open, onClose, onSaved, meUid,
}: {
  open: boolean; onClose: () => void; onSaved: () => void; meUid: string | null;
}) {
  const [step, setStep] = useState<0|1|2|3>(0);

  const [title, setTitle] = useState("");
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPrev, setImgPrev] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([{ name:"", qty:"", unit:"g" }]);
  const [steps, setSteps] = useState<string[]>(["", "", ""]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
  };
  const handleRowChange = (index: number, field: keyof Row) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setRows((list) =>
        list.map((row, rowIndex) =>
          rowIndex === index
            ? {
                ...row,
                [field]: field === "unit" ? (value as Row["unit"]) : value,
              }
            : row
        )
      );
    };

  useEffect(() => {
    if (!open) return;
    setStep(0); setTitle(""); setImgFile(null); setImgPrev(null);
    setRows([{name:"",qty:"",unit:"g"}]); setSteps(["","",""]);
    setErr(null);
  }, [open]);

  function setRow(i: number, patch: Partial<Row>) {
    setRows((list) => list.map((r,idx)=> idx===i ? {...r, ...patch} : r));
  }
  function addRow() { setRows((l)=>[...l, {name:"",qty:"",unit:"g"}]); }
  function removeRow(i:number){ setRows((l)=> l.length>1 ? l.filter((_,idx)=>idx!==i) : l); }

  function setStepText(i:number, val:string){ setSteps((s)=> s.map((t,idx)=> idx===i ? val : t)); }
  function addStep(){ setSteps((s)=> [...s, ""]); }
  function removeStep(i:number){ setSteps((s)=> s.length>1 ? s.filter((_,idx)=>idx!==i) : s); }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.currentTarget.files?.[0] || null;
    if (!f) return;
    setImgFile(f); setImgPrev(URL.createObjectURL(f));
  }

  async function save() {
    if (!meUid) return;
    const t = capFirst(title.trim());
    const cleanRows = rows
      .map(r => ({ name: r.name.trim(), qty: r.qty.trim(), unit: r.unit }))
      .filter(r => r.name && r.qty);
    if (!t) { setErr("Please enter a title."); setStep(0); return; }
    if (cleanRows.length === 0) { setErr("Please add at least one ingredient."); setStep(1); return; }

    const ingredients: Ingredient[] = cleanRows.map(r => ({
      name: r.name,
      measure: `${r.qty} ${r.unit}`.trim(),
    }));

    const instructionsText = steps
      .map((s,i)=> s.trim() ? `${i+1}) ${s.trim()}` : "")
      .filter(Boolean)
      .join("\n");

    const payload = {
      uid: meUid,
      author: { uid: meUid, name: auth.currentUser?.displayName || null } as { uid: string; name: string | null },
      title: t,
      titleLower: t.toLowerCase(),
      image: null as string | null,
      category: null as string | null,
      area: null as string | null,
      ingredients,
      instructions: instructionsText || null,
      createdAt: serverTimestamp(),
    };

    setBusy(true); setErr(null);
    try {
      const refDoc = await addDoc(collection(db, "recipes"), payload);
      if (imgFile) {
        const path = `recipeImages/${meUid}/${refDoc.id}/cover`;
        const storageRef = sref(storage, path);
        await uploadBytes(storageRef, imgFile, { contentType: imgFile.type });
        const url = await getDownloadURL(storageRef);
        await updateDoc(refDoc, { image: url });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save recipe.");
    } finally { setBusy(false); }
  }

  if (!open) return null;
  return (
    <div className="ov" onClick={onClose} role="dialog" aria-modal>
      <div className="wiz" onClick={(e)=>e.stopPropagation()}>
        <header className="header">
          <div className="title">Create recipe</div>
          <div className="dots">{[0,1,2,3].map(i => <span key={i} className={`dot ${i<=step?"on":""}`} />)}</div>
        </header>

        {step===0 && (
          <section className="slide">
            <Input label="Title" value={title} onChange={handleTitleChange} placeholder="Best Tomato Pasta" />
            <div>
              <label className="lab">Cover photo <span className="muted small">(optional)</span></label>
              {imgPrev ? (
                <div className="pick">
                  <img className="cover" src={imgPrev} alt="preview" />
                  <Button variant="secondary" size="sm" onClick={()=>{ setImgPrev(null); setImgFile(null); }}>Remove</Button>
                </div>
              ) : (
                <input type="file" accept="image/*" onChange={onPick} />
              )}
            </div>
          </section>
        )}

        {step===1 && (
          <section className="slide">
            <h3 className="h3">Ingredients</h3>
            <div className="rows">
              {rows.map((r, i) => (
                <div key={i} className="row">
                  <input className="name" placeholder="Ingredient (e.g. Tomato)"
                         value={r.name} onChange={(e)=>setRow(i,{name:e.currentTarget.value})} />
                  <input className="qty" type="number" min={0} placeholder="Qty"
                         value={r.qty} onChange={(e)=>setRow(i,{qty:e.currentTarget.value})} />
                  <select className="unit" value={r.unit} onChange={(e)=>setRow(i,{unit: e.currentTarget.value as Row["unit"]})}>
                    <option value="g">g</option><option value="kg">kg</option>
                    <option value="ml">ml</option><option value="l">l</option>
                    <option value="pcs">pcs</option><option value="tbsp">tbsp</option>
                    <option value="tsp">tsp</option><option value="cup">cup</option>
                  </select>
                  <button className="minus" onClick={()=>removeRow(i)} aria-label="Remove">âˆ’</button>
                </div>
              ))}
            </div>
            <div className="footerRow">
              <Button variant="secondary" onClick={addRow}>Add ingredient</Button>
            </div>
          </section>
        )}

        {step===2 && (
          <section className="slide">
            <h3 className="h3">Instructions</h3>
            <div className="steps">
              {steps.map((s, i) => (
                <div key={i} className="stepRow">
                  <div className="num">{i+1})</div>
                  <input className="stepInput" placeholder="Write stepâ€¦" value={s}
                         onChange={(e)=>setStepText(i,e.currentTarget.value)} />
                  <button className="minus" onClick={()=>removeStep(i)} aria-label="Remove">âˆ’</button>
                </div>
              ))}
            </div>
            <div className="footerRow">
              <Button variant="secondary" onClick={addStep}>Add step</Button>
            </div>
          </section>
        )}

        {step===3 && (
          <section className="slide">
            <h3 className="h3">Review</h3>
            <div className="review">
              <div><strong>Title:</strong> {title || <em>(missing)</em>}</div>
              <div><strong>Ingredients:</strong>
                <ul className="ul">{rows.filter(r=>r.name && r.qty).map((r,i)=><li key={i}>{r.name} â€” {r.qty} {r.unit}</li>)}</ul>
              </div>
              <div><strong>Instructions:</strong>
                <ul className="ul">{steps.filter(Boolean).map((s,i)=><li key={i}>{i+1}) {s}</li>)}</ul>
              </div>
            </div>
          </section>
        )}

        {err && <p className="error">{err}</p>}

        <footer className="actions">
          {step>0 ? (
            <Button variant="secondary" onClick={()=>setStep((s)=>((s-1) as any))}>Back</Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          )}
          {step<3 ? (
            <Button onClick={()=>setStep((s)=>((s+1) as any))}>Next</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={()=>setStep(0)}>No, go back</Button>
              <Button onClick={save} disabled={busy}>{busy ? "Savingâ€¦" : "Yes, save recipe"}</Button>
            </>
          )}
        </footer>
      </div>

      <style jsx>{`
        .ov{position:fixed;inset:0;background:rgba(2,6,23,.55);display:grid;place-items:center;padding:16px;z-index:1450}
        .wiz{width:100%;max-width:820px;max-height:92vh;overflow:auto;background:var(--card-bg);border-radius:16px;border:1px solid var(--border);box-shadow:0 20px 50px rgba(2,6,23,.18)}
        .header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding:12px 14px;background:color-mix(in oklab, var(--card-bg) 85%, #fff)}
        .title{font-weight:800;color:var(--text)}
        .dots{display:flex;gap:6px}
        .dot{width:10px;height:10px;border-radius:999px;background:#e5e7eb}.dot.on{background:var(--primary)}
        .slide{padding:14px;display:grid;gap:10px}
        .lab{display:block;margin:8px 0 6px;font-weight:600}
        .pick{display:flex;align-items:center;gap:12px}
        .cover{width:160px;height:100px;object-fit:cover;border-radius:10px;border:1px solid var(--border)}
        .h3{margin:6px 0 2px;color:var(--text)}
        .rows{display:grid;gap:8px}
        .row{display:grid;grid-template-columns:1fr 100px 110px 34px;gap:8px}
        .name,.qty,.unit{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--bg2);color:var(--text)}
        .minus{border:0;background:#ef4444;color:#fff;border-radius:10px;cursor:pointer}
        .footerRow{display:flex;justify-content:flex-end}
        .steps{display:grid;gap:8px}
        .stepRow{display:grid;grid-template-columns:44px 1fr 34px;gap:8px;align-items:center}
        .num{font-weight:800;color:var(--text);text-align:center}
        .stepInput{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--bg2);color:var(--text)}
        .review{border:1px solid var(--border);border-radius:12px;padding:10px;background:var(--bg2)}
        .ul{margin:6px 0 0; padding-left:18px}
        .actions{display:flex;justify-content:space-between;gap:8px;border-top:1px solid var(--border);padding:12px 14px;background:color-mix(in oklab, var(--card-bg) 92%, #fff)}
        .error{margin:8px 14px 0;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;font-size:13px}
      `}</style>
    </div>
  );
}

