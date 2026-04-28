"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, ChefHat, ChevronLeft, ChevronRight,
  Dumbbell, Flame, Lock, Pencil, Target, UtensilsCrossed, Check, X,
} from "lucide-react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebas1e";
import { useAuthModal } from "@/context/AuthModalContext";

// ── Week helpers ──────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekKey(date: Date): string {
  const mon = getMonday(date);
  const d = new Date(Date.UTC(mon.getFullYear(), mon.getMonth(), mon.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getMondayFromKey(weekKey: string): Date {
  const [yearStr, wStr] = weekKey.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(wStr, 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday;
}

function getWeekLabel(weekKey: string): string {
  const mon = getMondayFromKey(weekKey);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(mon)} – ${fmt(sun)}, ${sun.getUTCFullYear()}`;
}

function addWeeksToKey(weekKey: string, delta: number): string {
  const mon = getMondayFromKey(weekKey);
  mon.setUTCDate(mon.getUTCDate() + delta * 7);
  return getWeekKey(mon);
}

function isCurrentWeek(weekKey: string): boolean {
  return weekKey === getWeekKey(new Date());
}

// ── Meal templates ────────────────────────────────────────────────────────────

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_TYPES = ["Training Day", "Light Day", "Training Day", "Recovery Day", "Training Day", "Training Day", "Rest Day"];
const DAY_CALORIES = ["2,350 kcal", "2,100 kcal", "2,400 kcal", "2,050 kcal", "2,450 kcal", "2,300 kcal", "2,000 kcal"];

const TEMPLATES: string[][][] = [
  [
    ["Breakfast — Greek yogurt, oats, berries, chia", "Lunch — Chicken rice bowl with greens", "Snack — Banana + peanut butter", "Dinner — Salmon, potatoes, broccoli"],
    ["Breakfast — Eggs on toast with avocado", "Lunch — Turkey wrap with salad", "Snack — Protein yogurt", "Dinner — Lean beef, rice, vegetables"],
    ["Breakfast — Protein oats with banana", "Lunch — Pasta with chicken and tomato sauce", "Snack — Rice cakes + cottage cheese", "Dinner — Stir fry chicken and vegetables"],
    ["Breakfast — Smoothie bowl", "Lunch — Tuna salad bowl", "Snack — Apple + almonds", "Dinner — Turkey mince with roasted vegetables"],
    ["Breakfast — Eggs, oats, fruit", "Lunch — Chicken burrito bowl", "Snack — Protein shake", "Dinner — Steak, sweet potato, salad"],
    ["Breakfast — Pancakes with yogurt", "Lunch — Pasta salad with chicken", "Snack — Mixed nuts + fruit", "Dinner — Homemade burger bowl"],
    ["Breakfast — Scrambled eggs + toast", "Lunch — Soup + sandwich", "Snack — Cottage cheese + berries", "Dinner — Grilled chicken and vegetables"],
  ],
  [
    ["Breakfast — Egg white omelette with spinach", "Lunch — Grilled chicken + quinoa salad", "Snack — Tuna on rice cakes", "Dinner — Sirloin steak, asparagus, brown rice"],
    ["Breakfast — Protein shake + banana", "Lunch — Turkey and avocado wrap", "Snack — Hard boiled eggs", "Dinner — Salmon fillet, roasted broccoli, sweet potato"],
    ["Breakfast — Cottage cheese bowl with berries", "Lunch — Beef and rice bowl", "Snack — Edamame + almonds", "Dinner — Prawn stir fry with noodles"],
    ["Breakfast — Smoked salmon + poached eggs", "Lunch — Chicken caesar salad", "Snack — Greek yogurt + walnuts", "Dinner — Baked cod with vegetables"],
    ["Breakfast — Oats with protein powder", "Lunch — Lean mince and pasta", "Snack — Protein bar", "Dinner — Chicken thighs, roasted peppers, rice"],
    ["Breakfast — Waffles with eggs and turkey bacon", "Lunch — Tuna pasta salad", "Snack — Hummus and carrot sticks", "Dinner — BBQ chicken, corn, coleslaw"],
    ["Breakfast — Full eggs, toast, avocado", "Lunch — Chicken noodle soup", "Snack — Cheese and crackers", "Dinner — Roast chicken and vegetables"],
  ],
  [
    ["Breakfast — Overnight oats with seeds", "Lunch — Lentil and vegetable soup", "Snack — Handful of trail mix", "Dinner — Chickpea curry with brown rice"],
    ["Breakfast — Smoothie with spinach and banana", "Lunch — Falafel wrap with hummus", "Snack — Apple slices + almond butter", "Dinner — Tofu stir fry with noodles"],
    ["Breakfast — Avocado toast with seeds", "Lunch — Quinoa and roasted vegetable bowl", "Snack — Edamame", "Dinner — Black bean tacos with salsa"],
    ["Breakfast — Chia pudding with berries", "Lunch — Tomato and basil pasta", "Snack — Rice cakes + peanut butter", "Dinner — Mushroom and spinach risotto"],
    ["Breakfast — Granola with oat milk", "Lunch — Sweet potato and kale bowl", "Snack — Dates and cashews", "Dinner — Red lentil dhal with flatbread"],
    ["Breakfast — Banana pancakes", "Lunch — Vegetable and bean chilli", "Snack — Fruit salad", "Dinner — Veggie burgers with sweet potato fries"],
    ["Breakfast — Porridge with fruit", "Lunch — Minestrone soup", "Snack — Crackers and hummus", "Dinner — Jacket potato with beans and salad"],
  ],
  [
    ["Breakfast — French toast with maple syrup", "Lunch — Grilled chicken salad", "Snack — Yogurt parfait", "Dinner — Spaghetti bolognese"],
    ["Breakfast — Mushroom scramble on sourdough", "Lunch — BLT sandwich + fruit", "Snack — Cheese and grapes", "Dinner — Fish tacos with slaw"],
    ["Breakfast — Bircher muesli", "Lunch — Caesar wrap with chicken", "Snack — Trail mix bar", "Dinner — Chicken and vegetable pie"],
    ["Breakfast — Poached eggs and smashed avocado", "Lunch — Tomato soup + crusty bread", "Snack — Banana", "Dinner — Lamb chops, mash, green beans"],
    ["Breakfast — Bagel with cream cheese and salmon", "Lunch — Pasta primavera", "Snack — Dark chocolate + nuts", "Dinner — Beef stir fry and rice"],
    ["Breakfast — Full English (lighter)", "Lunch — Club sandwich + salad", "Snack — Smoothie", "Dinner — Homemade pizza"],
    ["Breakfast — Waffles with fresh berries", "Lunch — Roast vegetable wrap", "Snack — Rice pudding", "Dinner — Sunday roast chicken"],
  ],
];

function buildDefaultPlan(weekKey: string): WeekPlan {
  const weekNum = parseInt(weekKey.split("-W")[1] || "0", 10);
  const template = TEMPLATES[weekNum % 4];
  const plan: WeekPlan = {};
  DAY_NAMES.forEach((day, i) => {
    plan[day] = { type: DAY_TYPES[i], calories: DAY_CALORIES[i], meals: [...template[i]] };
  });
  return plan;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DayPlan = { type: string; calories: string; meals: string[] };
type WeekPlan = Record<string, DayPlan>;

// ── Save helper ───────────────────────────────────────────────────────────────

async function savePlan(uid: string, weekKey: string, plan: WeekPlan) {
  await setDoc(doc(db, "mealPlans", `${uid}_${weekKey}`), {
    uid,
    weekKey,
    days: plan,
    updatedAt: serverTimestamp(),
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MealPlanPage() {
  const { openLogin, openRegister } = useAuthModal();
  const [me, setMe] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);

  const [weekKey, setWeekKey] = useState(() => getWeekKey(new Date()));
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // editing: { day, mealIndex }
  const [editing, setEditing] = useState<{ day: string; mealIndex: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => onAuthStateChanged(auth, (u) => { setMe(u); setAuthReady(true); }), []);

  // Load plan whenever user or week changes
  useEffect(() => {
    if (!me) { setPlan(null); return; }
    setLoading(true);
    const docRef = doc(db, "mealPlans", `${me.uid}_${weekKey}`);
    getDoc(docRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPlan(data.days as WeekPlan);
      } else {
        setPlan(buildDefaultPlan(weekKey));
      }
    }).catch(() => {
      setPlan(buildDefaultPlan(weekKey));
    }).finally(() => setLoading(false));
  }, [me, weekKey]);

  // Focus input when editing starts
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = useCallback((day: string, mealIndex: number, currentValue: string) => {
    setEditing({ day, mealIndex });
    setEditValue(currentValue);
  }, []);

  const commitEdit = useCallback(async () => {
    if (!editing || !me || !plan) return;
    const { day, mealIndex } = editing;
    const newPlan: WeekPlan = {
      ...plan,
      [day]: {
        ...plan[day],
        meals: plan[day].meals.map((m, i) => (i === mealIndex ? editValue.trim() || m : m)),
      },
    };
    setPlan(newPlan);
    setEditing(null);
    setSaving(true);
    try { await savePlan(me.uid, weekKey, newPlan); } finally { setSaving(false); }
  }, [editing, editValue, me, plan, weekKey]);

  const cancelEdit = useCallback(() => setEditing(null), []);

  if (!authReady) return null;

  if (!me) {
    return (
      <div className="mealPlanPage">
        <div className="authGate">
          <div className="authGateIcon"><Lock size={32} /></div>
          <h1>Sign in to view your meal plan</h1>
          <p>Your weekly meal plan is personal to you. Create an account or sign in to access it.</p>
          <div className="authGateActions">
            <button type="button" className="primaryBtn" onClick={() => openRegister("/meal-plan")}>Create account</button>
            <button type="button" className="secondaryBtn" onClick={() => openLogin("/meal-plan")}>Sign in</button>
          </div>
        </div>
        <style jsx>{`
          .mealPlanPage { width: min(1180px, 100%); margin: 0 auto; padding: 28px 24px 40px; }
          .authGate { min-height: 480px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 16px; border-radius: 24px; background: var(--bg-raised); border: 1px solid var(--border); padding: 48px 32px; }
          .authGateIcon { width: 72px; height: 72px; border-radius: 999px; display: grid; place-items: center; background: color-mix(in oklab, var(--primary) 14%, transparent); color: var(--primary); }
          .authGate h1 { margin: 0; font-size: clamp(22px, 3vw, 32px); letter-spacing: -.05em; color: var(--text); }
          .authGate p { margin: 0; max-width: 42ch; color: var(--muted); font-size: 15px; }
          .authGateActions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 8px; }
          .primaryBtn, .secondaryBtn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 22px; border-radius: 999px; font: inherit; font-size: 14px; font-weight: 800; cursor: pointer; border: 0; text-decoration: none; }
          .primaryBtn { background: var(--primary); color: var(--primary-contrast); }
          .secondaryBtn { background: var(--bg2); color: var(--text); border: 1px solid var(--border); }
        `}</style>
      </div>
    );
  }

  return (
    <div className="mealPlanPage">
      {/* Hero */}
      <section className="hero">
        <div className="heroText">
          <span className="eyebrow">Meal planning</span>
          <h1>Your weekly meal plan</h1>
          <p>A personalised plan for every week. Tap any meal to edit it and your changes are saved automatically.</p>
          <div className="heroActions">
            <Link href="/recipes" className="primaryBtn">
              <ChefHat size={16} /> Browse Recipes
            </Link>
            <Link href="/fitness" className="secondaryBtn">
              <Dumbbell size={16} /> Open Training
            </Link>
          </div>
        </div>

        <div className="summaryGrid">
          <div className="summaryCard"><CalendarDays size={18} /><div><strong>7 day plan</strong><span>Organised by day</span></div></div>
          <div className="summaryCard"><Flame size={18} /><div><strong>Goal aligned</strong><span>Calories per day</span></div></div>
          <div className="summaryCard"><Target size={18} /><div><strong>Training synced</strong><span>More food on workout days</span></div></div>
        </div>
      </section>

      {/* Week navigator */}
      <div className="weekNav">
        <button
          type="button"
          className="weekBtn"
          onClick={() => setWeekKey((k) => addWeeksToKey(k, -1))}
          aria-label="Previous week"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="weekLabel">
          <span>{getWeekLabel(weekKey)}</span>
          {isCurrentWeek(weekKey) && <span className="currentBadge">This week</span>}
          {saving && <span className="savingDot" title="Saving…" />}
        </div>

        <button
          type="button"
          className="weekBtn"
          onClick={() => setWeekKey((k) => addWeeksToKey(k, 1))}
          aria-label="Next week"
        >
          <ChevronRight size={18} />
        </button>

        {!isCurrentWeek(weekKey) && (
          <button
            type="button"
            className="todayBtn"
            onClick={() => setWeekKey(getWeekKey(new Date()))}
          >
            Today
          </button>
        )}
      </div>

      {/* Day cards */}
      {loading || !plan ? (
        <div className="loadingGrid">
          {DAY_NAMES.map((d) => <div key={d} className="dayCardSkeleton" />)}
        </div>
      ) : (
        <section className="weekGrid">
          {DAY_NAMES.map((day) => {
            const dayPlan = plan[day];
            if (!dayPlan) return null;
            return (
              <article key={day} className="dayCard">
                <div className="dayHead">
                  <div>
                    <h2>{day}</h2>
                    <p>{dayPlan.type}</p>
                  </div>
                  <span className="caloriePill">{dayPlan.calories}</span>
                </div>

                <div className="mealList">
                  {dayPlan.meals.map((meal, mealIndex) => {
                    const isEditing = editing?.day === day && editing?.mealIndex === mealIndex;
                    return (
                      <div key={mealIndex} className={`mealRow${isEditing ? " editing" : ""}`}>
                        <UtensilsCrossed size={15} className="mealIcon" />
                        {isEditing ? (
                          <div className="editField">
                            <input
                              ref={inputRef}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit();
                                if (e.key === "Escape") cancelEdit();
                              }}
                            />
                            <button type="button" className="editAction confirm" onClick={commitEdit} aria-label="Save"><Check size={14} /></button>
                            <button type="button" className="editAction cancel" onClick={cancelEdit} aria-label="Cancel"><X size={14} /></button>
                          </div>
                        ) : (
                          <>
                            <span>{meal}</span>
                            <button
                              type="button"
                              className="editBtn"
                              onClick={() => startEdit(day, mealIndex, meal)}
                              aria-label={`Edit ${meal}`}
                            >
                              <Pencil size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <style jsx>{`
        .mealPlanPage {
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: 28px 24px 40px;
          display: grid;
          gap: 20px;
        }

        /* Hero */
        .hero { display: grid; grid-template-columns: 1.2fr 0.9fr; gap: 20px; }
        .heroText, .summaryGrid, .dayCard { border: 1px solid var(--border); background: var(--bg-raised); border-radius: 24px; }
        .heroText { padding: 28px; }
        .eyebrow { display: inline-block; margin-bottom: 8px; font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--primary); }
        .heroText h1 { margin: 0 0 10px; font-size: clamp(28px, 4vw, 44px); line-height: 1.05; color: var(--text); }
        .heroText p { max-width: 520px; margin-bottom: 18px; color: var(--muted); }
        .heroActions { display: flex; flex-wrap: wrap; gap: 12px; }
        .primaryBtn, .secondaryBtn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 14px; font: inherit; font-weight: 700; font-size: 14px; text-decoration: none; cursor: pointer; border: 0; }
        .primaryBtn { background: var(--primary); color: var(--primary-contrast); }
        .secondaryBtn { background: var(--bg); color: var(--text); border: 1px solid var(--border); }
        .summaryGrid { padding: 20px; display: grid; gap: 12px; align-content: start; }
        .summaryCard { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 16px; background: var(--bg); border: 1px solid var(--border); }
        .summaryCard strong { display: block; font-size: 14px; color: var(--text); }
        .summaryCard span { display: block; font-size: 12px; color: var(--muted); }

        /* Week nav */
        .weekNav {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border-radius: 20px;
          background: var(--bg-raised);
          border: 1px solid var(--border);
        }
        .weekBtn {
          width: 36px; height: 36px; border-radius: 12px; border: 1px solid var(--border);
          background: var(--bg); color: var(--text); display: grid; place-items: center; cursor: pointer;
          flex-shrink: 0;
        }
        .weekBtn:hover { background: var(--bg2); }
        .weekLabel {
          flex: 1; display: flex; align-items: center; gap: 10px;
          font-size: 15px; font-weight: 800; color: var(--text);
        }
        .currentBadge {
          font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
          padding: 4px 10px; border-radius: 999px;
          background: color-mix(in oklab, var(--primary) 18%, transparent);
          color: var(--primary);
        }
        .savingDot {
          width: 8px; height: 8px; border-radius: 999px;
          background: var(--primary); opacity: .7;
          animation: pulse 1s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
        .todayBtn {
          padding: 8px 16px; border-radius: 999px; border: 1px solid var(--border);
          background: var(--bg); color: var(--text); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .todayBtn:hover { background: var(--bg2); }

        /* Loading skeleton */
        .loadingGrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        .dayCardSkeleton { height: 220px; border-radius: 24px; background: var(--bg-raised); border: 1px solid var(--border); animation: shimmer 1.4s ease-in-out infinite; }
        @keyframes shimmer { 0%,100% { opacity: .5; } 50% { opacity: 1; } }

        /* Day cards */
        .weekGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
        .dayCard { padding: 20px; }
        .dayHead { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 16px; }
        .dayHead h2 { margin: 0 0 4px; font-size: 20px; color: var(--text); }
        .dayHead p { margin: 0; font-size: 13px; color: var(--muted); }
        .caloriePill { padding: 8px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg); font-size: 12px; font-weight: 800; white-space: nowrap; color: var(--text); }
        .mealList { display: grid; gap: 8px; }
        .mealRow {
          display: flex; gap: 10px; align-items: center;
          padding: 10px 12px; border-radius: 14px;
          background: var(--bg); border: 1px solid var(--border);
          color: var(--text); font-size: 14px;
          transition: border-color .15s;
        }
        .mealRow.editing { border-color: var(--primary); }
        .mealRow:hover .editBtn { opacity: 1; }
        .mealRow span { flex: 1; }
        .mealIcon { flex-shrink: 0; color: var(--muted); }
        .editBtn {
          flex-shrink: 0; opacity: 0; width: 26px; height: 26px; border-radius: 8px;
          border: 0; background: var(--bg2); color: var(--muted); display: grid;
          place-items: center; cursor: pointer; transition: opacity .15s;
        }
        .editBtn:hover { color: var(--text); }

        /* Inline edit */
        .editField { flex: 1; display: flex; gap: 6px; align-items: center; }
        .editField input {
          flex: 1; border: 0; background: transparent; outline: none;
          font: inherit; font-size: 14px; color: var(--text); padding: 0;
        }
        .editAction {
          flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px; border: 0;
          display: grid; place-items: center; cursor: pointer;
        }
        .editAction.confirm { background: color-mix(in oklab, var(--primary) 18%, transparent); color: var(--primary); }
        .editAction.cancel { background: var(--bg2); color: var(--muted); }

        @media (max-width: 900px) {
          .hero { grid-template-columns: 1fr; }
          .weekGrid, .loadingGrid { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .mealPlanPage { padding: 20px 16px 28px; }
          .heroText, .summaryGrid, .dayCard { border-radius: 20px; }
          .heroText { padding: 22px; }
        }
      `}</style>
    </div>
  );
}
