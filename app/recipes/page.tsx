"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// NOTE: if your file is actually "firebas1e", switch it back.
import { auth, db } from "@/lib/firebas1e";

import Button from "@/components/ui/Button";
import { useAuthModal } from "@/context/AuthModalContext";
import type { CommonRecipe, Ingredient } from "@/components/recipes/types";
import RecipeModal from "@/components/recipes/RecipeModal";
import { getRecipePlaceholder } from "@/components/recipes/RecipeCard";
import IngredientSearch from "@/components/recipes/IngredientSearch";
import SaveRecipeButton from "@/components/recipes/SaveRecipeButton";
import CreateRecipeWizard from "@/components/recipes/CreateRecipeWizard";
import {
  getRandomMeals,
  searchMealsByName,
  lookupMealById,
  searchMealsByIngredientsAND,
  searchMealsByIngredientsPaged,
} from "@/lib/recipesApi";

/* -------------------------- helpers & type guards -------------------------- */

const INGREDIENT_PAGE_SIZE = 12;

type TimestampLike =
  | { seconds?: number; toDate?: () => Date }
  | Date
  | number
  | string
  | null
  | undefined;

const toMillis = (ts: TimestampLike): number => {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "string") {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof ts === "object") {
    if (typeof ts.toDate === "function") {
      try {
        return ts.toDate().getTime();
      } catch {
        return 0;
      }
    }
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
  }
  return 0;
};

const safeString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const safeNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const safeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

const extractFromRecord = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
};

const getRecipeImage = (recipe: CommonRecipe): string | null => {
  if (recipe.image) return recipe.image;
  const record = recipe as Record<string, unknown>;
  return (
    extractFromRecord(record, ["imageURL", "imageUrl", "cover", "coverUrl", "coverURL"]) ?? null
  );
};

const getRecipeMinutes = (recipe: CommonRecipe): number | null => {
  const record = recipe as Record<string, unknown>;
  return safeNumber(record.timeMinutes ?? record.minutes);
};

const getRecipeServings = (recipe: CommonRecipe): number | null => {
  const record = recipe as Record<string, unknown>;
  return safeNumber(record.servings);
};

/** Ingredient[] used by your domain types. */
const normalizeIngredients = (value: unknown): Ingredient[] => {
  if (!Array.isArray(value)) return [];
  const result: Ingredient[] = [];
  for (const entry of value) {
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const name = safeNullableString(record.name);
      if (name) {
        const measureValue = safeNullableString(record.measure);
        result.push({ name, measure: measureValue ?? "" });
      }
    }
  }
  return result;
};

type RecipeListItem = CommonRecipe & {
  createdAtMillis: number;
  minutes?: number | null;
  servings?: number | null;
  calories?: number | null;
  vegetarian?: boolean | null;
  vegan?: boolean | null;
};

const withRecipeMeta = (recipe: CommonRecipe): RecipeListItem => {
  const record = recipe as Record<string, unknown>;
  return {
    ...recipe,
    ingredients: normalizeIngredients((recipe as CommonRecipe).ingredients),
    instructions: safeNullableString((recipe as CommonRecipe).instructions) ?? recipe.instructions ?? null,
    createdAtMillis: toMillis(record.createdAt as TimestampLike),
    minutes: safeNumber(record.timeMinutes ?? record.minutes),
    servings: safeNumber(record.servings),
    calories: safeNumber(record.calories),
    vegetarian: typeof record.vegetarian === "boolean" ? record.vegetarian : recipe.vegetarian ?? null,
    vegan: typeof record.vegan === "boolean" ? record.vegan : recipe.vegan ?? null,
  };
};

const mapUserRecipeDoc = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
  ownerUid: string
): RecipeListItem => {
  const data = snapshot.data() as Record<string, unknown>;
  const authorRecord =
    data.author && typeof data.author === "object"
      ? (data.author as Record<string, unknown>)
      : undefined;

  const author = {
    uid: safeNullableString(authorRecord?.uid) ?? safeNullableString(data.uid) ?? ownerUid ?? null,
    name: safeNullableString(authorRecord?.name),
  };

  const createdAtMillis = toMillis(data.createdAt as TimestampLike);
  const image =
    safeNullableString(data.image) ??
    extractFromRecord(data, ["imageURL", "imageUrl", "cover", "coverUrl", "coverURL"]);

  return {
    id: snapshot.id,
    source: "user",
    title: safeString(data.title, "Untitled"),
    image: image ?? null,
    category: safeNullableString(data.category),
    area: safeNullableString(data.area),
    ingredients: normalizeIngredients(data.ingredients),
    instructions: safeNullableString(data.instructions),
    author,
    createdAtMillis,
    minutes: safeNumber(data.timeMinutes ?? data.minutes),
    servings: safeNumber(data.servings),
    calories: safeNumber(data.calories),
    vegetarian: typeof data.vegetarian === "boolean" ? data.vegetarian : null,
    vegan: typeof data.vegan === "boolean" ? data.vegan : null,
  } as RecipeListItem;
};

/* -------------------------------- components -------------------------------- */

function PantryPicker({
  open,
  onClose,
  allItems,
  onSearch,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  allItems: string[];
  onSearch: (terms: string[]) => void;
  busy?: boolean;
}) {
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => {
    if (open) setSel([]);
  }, [open]);
  function toggle(n: string) {
    setSel((xs) => (xs.includes(n) ? xs.filter((v) => v !== n) : [...xs, n]));
  }
  if (!open) return null;
  return (
    <div className="ov" onClick={onClose} role="dialog" aria-modal>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <div className="bh">
          <div className="bt">Find recipes with my pantry</div>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </div>
        {allItems.length === 0 ? (
          <p className="muted small" style={{ padding: 12 }}>
            Your pantry is empty.
          </p>
        ) : (
          <>
            <div className="chips">
              {allItems.map((n) => (
                <label key={n} className={`chip ${sel.includes(n) ? "on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={sel.includes(n)}
                    onChange={() => toggle(n)}
                  />
                  <span>{n}</span>
                </label>
              ))}
            </div>
            <div className="row">
              <Button onClick={() => onSearch(sel)} disabled={!sel.length || !!busy}>
                {busy ? "Searching…" : `Search (${sel.length})`}
              </Button>
              <Button variant="secondary" onClick={onClose} disabled={!!busy}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
      <style jsx>{`
        .ov {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.55);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 1400;
        }
        .box {
          width: 100%;
          max-width: 760px;
          max-height: 90vh;
          overflow: auto;
          background: var(--card-bg);
          border-radius: 16px;
          border: 1px solid var(--border);
        }
        .bh {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border);
          padding: 10px 12px;
        }
        .bt {
          font-weight: 800;
          color: var(--text);
        }
        .x {
          border: none;
          background: var(--text);
          color: var(--primary-contrast);
          border-radius: 10px;
          padding: 4px 10px;
          cursor: pointer;
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          padding: 12px;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 6px 10px;
          background: var(--bg2);
          cursor: pointer;
          user-select: none;
        }
        .chip input {
          display: none;
        }
        .chip.on {
          background: #e0f2fe;
          border-color: #7dd3fc;
        }
        .row {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          padding: 0 12px 12px;
        }
      `}</style>
    </div>
  );
}

function RecipeSkeletons() {
  return (
    <div className="skelGrid">
      {Array.from({ length: 9 }).map((_, i) => (
        <div className="skelCard" key={i}>
          <div className="skelMedia" />
          <div className="skelBody">
            <div className="skelLine lg" />
            <div className="skelLine md" />
            <div className="skelLine sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RecipesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openRegister } = useAuthModal();
  const [me, setMe] = useState<string | null>(null);

  const [apiRecipes, setApiRecipes] = useState<RecipeListItem[]>([]);
  const [userRecipes, setUserRecipes] = useState<RecipeListItem[]>([]);
  const [pantryRecipes, setPantryRecipes] = useState<RecipeListItem[] | null>(null);

  const [pantry, setPantry] = useState<string[]>([]);

  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"name" | "ingredient">("name");
  const [areaFilter, setAreaFilter] = useState<string>("any");
  const [sortBy, setSortBy] = useState<"match" | "fast" | "calories">("match");
  const [diet, setDiet] = useState<
    "any" | "vegetarian" | "vegan" | "pescetarian" | "gluten free" | "ketogenic"
  >("any");
  const [maxTime, setMaxTime] = useState<number | null>(null);
  const [busySearch, setBusySearch] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const [openModal, setOpenModal] = useState<CommonRecipe | null>(null);
  const [showPantryPicker, setShowPantryPicker] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [ingredientValue, setIngredientValue] = useState("");
  const [ingredientChips, setIngredientChips] = useState<string[]>([]);
  const [lastIngredientSearch, setLastIngredientSearch] = useState<string[]>([]);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [urlReady, setUrlReady] = useState(false);
  const [ingredientOffset, setIngredientOffset] = useState(0);
  const [ingredientTotal, setIngredientTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const didInit = useRef(false);
  const didAutoSearch = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const modeParam = searchParams.get("mode");
    const qParam = searchParams.get("q");
    const ingParam = searchParams.get("ing");
    const dietParam = searchParams.get("diet");
    const sortParam = searchParams.get("sort");
    const maxParam = searchParams.get("max");
    const areaParam = searchParams.get("area");

    if (modeParam === "ingredient") setMode("ingredient");
    if (qParam) setQ(qParam);
    if (ingParam) {
      const chips = ingParam
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      if (chips.length) {
        setIngredientChips(chips);
        setLastIngredientSearch(chips);
      }
    }
    if (
      dietParam === "vegetarian" ||
      dietParam === "vegan" ||
      dietParam === "pescetarian" ||
      dietParam === "gluten free" ||
      dietParam === "ketogenic"
    ) {
      setDiet(dietParam);
    }
    if (sortParam === "fast" || sortParam === "calories") setSortBy(sortParam);
    if (maxParam) {
      const parsed = Number(maxParam);
      if (Number.isFinite(parsed)) setMaxTime(parsed);
    }
    if (areaParam) setAreaFilter(areaParam);
    setUrlReady(true);
  }, [searchParams]);

  useEffect(() => {
    const createParam = searchParams.get("create");
    if (!createParam) return;

    if (!me) {
      openRegister("/recipes?create=1");
      return;
    }

    setShowWizard(true);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("create");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/recipes?${nextQuery}` : "/recipes", { scroll: false });
  }, [me, openRegister, router, searchParams]);

  useEffect(() => {
    let stopUserSub: (() => void) | null = null;
    let stopPantrySub: (() => void) | null = null;

    const cleanupUserSubs = () => {
      if (stopUserSub) stopUserSub();
      if (stopPantrySub) stopPantrySub();
      stopUserSub = stopPantrySub = null;
    };

    setMe(auth.currentUser?.uid ?? null);

    const stopAuth = onAuthStateChanged(auth, (u) => {
      cleanupUserSubs();
      setMe(u?.uid ?? null);

      if (u) {
        const qMine = query(collection(db, "recipes"), where("uid", "==", u.uid));
        stopUserSub = onSnapshot(
          qMine,
          (snap) => {
            const rows = snap.docs
              .map((docSnapshot) => mapUserRecipeDoc(docSnapshot, u.uid))
              .sort((a, b) => b.createdAtMillis - a.createdAtMillis);
            setUserRecipes(rows);
          },
          () => {}
        );

        const pq = query(collection(db, "pantryItems"), where("uid", "==", u.uid));
        stopPantrySub = onSnapshot(pq, (snap) => {
          const names = snap.docs
            .map((docSnapshot) => {
              const data = docSnapshot.data() as Record<string, unknown>;
              const name = safeNullableString(data?.name);
              return name ? name.trim().toLowerCase() : "";
            })
            .filter((name) => name.length > 0);
          const uniq = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
          setPantry(uniq);
        });
      } else {
        setUserRecipes([]);
        setPantry([]);
      }
    });

    return () => {
      stopAuth();
      cleanupUserSubs();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setInitialLoading(true);
      try {
        const list = await getRandomMeals(15);
        if (alive) setApiRecipes(list.map(withRecipeMeta));
      } catch {
        // ignore
      } finally {
        if (alive) setInitialLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (mode === "ingredient") params.set("mode", "ingredient");
    if (mode === "name" && q.trim()) params.set("q", q.trim());
    if (mode === "ingredient" && ingredientChips.length) {
      params.set("ing", ingredientChips.join(","));
    }
    if (diet !== "any") params.set("diet", diet);
    if (sortBy !== "match") params.set("sort", sortBy);
    if (typeof maxTime === "number") params.set("max", String(maxTime));
    if (areaFilter !== "any") params.set("area", areaFilter);
    const next = params.toString();
    router.replace(next ? `?${next}` : "/recipes", { scroll: false });
  }, [router, mode, q, ingredientChips, diet, sortBy, maxTime, areaFilter, urlReady]);

  useEffect(() => {
    if (mode !== "name") return;
    const id = setTimeout(async () => {
      setErr(null);
      setPantryRecipes(null);
      if (!q.trim()) {
        const list = await getRandomMeals(15);
        setApiRecipes(list.map(withRecipeMeta));
        setBusySearch(false);
        return;
      }
      setBusySearch(true);
      try {
        const list = await searchMealsByName(q.trim(), 24, {
          area: areaFilter,
          diet,
          sort: sortBy,
          maxTime,
        });
        setApiRecipes(list.map(withRecipeMeta));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Search failed.";
        setErr(message);
      } finally {
        setBusySearch(false);
      }
    }, 280);
    return () => clearTimeout(id);
  }, [q, mode, areaFilter, diet, sortBy, maxTime]);

  useEffect(() => {
    if (mode === "ingredient") {
      setPantryRecipes(null);
      setErr(null);
      return;
    }
    setIngredientOffset(0);
    setIngredientTotal(0);
    setLastIngredientSearch([]);
  }, [mode]);

  useEffect(() => {
    if (mode !== "ingredient") return;
    if (!ingredientChips.length) return;
    if (didAutoSearch.current) return;
    didAutoSearch.current = true;
    runIngredientSearch(ingredientChips);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ingredientChips]);

  /* ---------- pantry picker → AND search ---------- */
  async function runPantrySearch(terms: string[]) {
    setErr(null);
    setBusySearch(true);
    setShowPantryPicker(false);
    try {
      const results = await searchMealsByIngredientsAND(terms, 36, "intersect", {
        area: areaFilter,
        diet,
        sort: sortBy,
        maxTime,
      });
      setPantryRecipes(results.map(withRecipeMeta));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Pantry search failed.";
      setErr(message);
    } finally {
      setBusySearch(false);
    }
  }

  async function runIngredientSearch(terms: string[], reset = true) {
    setErr(null);
    setPantryRecipes(null);
    if (reset) {
      setIngredientOffset(0);
      setIngredientTotal(0);
      setBusySearch(true);
    } else {
      setLoadingMore(true);
    }
    setLastIngredientSearch(terms);
    try {
      const nextOffset = reset ? 0 : ingredientOffset + INGREDIENT_PAGE_SIZE;
      const result = await searchMealsByIngredientsPaged(terms, INGREDIENT_PAGE_SIZE, nextOffset, {
        area: areaFilter,
        diet,
        sort: sortBy,
        maxTime,
      });
      setIngredientOffset(nextOffset);
      setIngredientTotal(result.total);
      setApiRecipes((prev) =>
        reset ? result.recipes.map(withRecipeMeta) : [...prev, ...result.recipes.map(withRecipeMeta)]
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Ingredient search failed.";
      setErr(message);
    } finally {
      if (reset) {
        setBusySearch(false);
      } else {
        setLoadingMore(false);
      }
    }
  }

  async function retrySearch() {
    setErr(null);
    setPantryRecipes(null);
    if (mode === "ingredient") {
      const terms = lastIngredientSearch.length ? lastIngredientSearch : ingredientChips;
      if (!terms.length) {
        setErr("Please add at least one ingredient.");
        return;
      }
      await runIngredientSearch(terms);
      return;
    }

    setBusySearch(true);
    try {
      if (!q.trim()) {
        const list = await getRandomMeals(15);
        setApiRecipes(list.map(withRecipeMeta));
      } else {
        const list = await searchMealsByName(q.trim(), 24, {
          area: areaFilter,
          diet,
          sort: sortBy,
          maxTime,
        });
        setApiRecipes(list.map(withRecipeMeta));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Search failed.";
      setErr(message);
    } finally {
      setBusySearch(false);
    }
  }

  function clearSearch() {
    setQ("");
    setIngredientValue("");
    setIngredientChips([]);
    setLastIngredientSearch([]);
    setDiet("any");
    setSortBy("match");
    setMaxTime(null);
    setAreaFilter("any");
    setPantryRecipes(null);
    setIngredientOffset(0);
    setIngredientTotal(0);
  }

  function handleRecipeShare(r: { id: string; title: string; source: string }) {
    const path = r.source === "user" ? `/recipes/${r.id}` : `/recipes/ext/${r.id}`;
    const url = `${window.location.origin}${path}`;
    const shareData = { title: r.title || "Recipe", url };
    if (typeof navigator.share === "function" && navigator.canShare?.(shareData)) {
      navigator.share(shareData).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(url).then(() => {}).catch(() => {});
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopiedId(r.id);
    copyTimerRef.current = setTimeout(() => setCopiedId(null), 2400);
  }

  async function openRecipe(recipe: RecipeListItem) {
    if (recipe.source !== "user") {
      const full = await lookupMealById(recipe.id);
      setOpenModal(full ?? recipe);
      return;
    }
    setOpenModal(recipe);
  }

  const userFiltered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (mode !== "name") return [];
    if (!s) return userRecipes;
    return userRecipes.filter((r) => (r.title || "").toLowerCase().includes(s));
  }, [userRecipes, q, mode]);

  const combined = useMemo(() => {
    if (pantryRecipes) return pantryRecipes;
    return [...userFiltered, ...apiRecipes];
  }, [pantryRecipes, userFiltered, apiRecipes]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    combined.forEach((r) => {
      if (r.area) set.add(String(r.area));
    });
    return ["any", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [combined]);

  const visibleRecipes = useMemo(() => {
    let list = combined;
    if (areaFilter !== "any") {
      list = list.filter((r) => (r.area || "").toLowerCase() === areaFilter.toLowerCase());
    }
    if (sortBy === "fast") {
      list = [...list].sort((a, b) => {
        const am = typeof a.minutes === "number" ? a.minutes : Number.POSITIVE_INFINITY;
        const bm = typeof b.minutes === "number" ? b.minutes : Number.POSITIVE_INFINITY;
        return am - bm;
      });
    } else if (sortBy === "calories") {
      list = [...list].sort((a, b) => {
        const ac = typeof a.calories === "number" ? a.calories : Number.POSITIVE_INFINITY;
        const bc = typeof b.calories === "number" ? b.calories : Number.POSITIVE_INFINITY;
        return ac - bc;
      });
    }
    return list;
  }, [combined, areaFilter, sortBy]);

  const isSignedIn = !!me;
  const isLoading = initialLoading || busySearch;

  return (
    <main className="container recipesPage">
      <div className="topbar">
        <div className="titleBlock">
          <span className="eyebrow">Recipe Library</span>
          <h1 className="title">Recipes</h1>
          <p className="intro">Search ideas, filter faster, and create recipes from the same place.</p>
        </div>
        <div className="right">
          {!isSignedIn && (
            <div className="signinHint">
              <strong>Tip:</strong> Sign in to create recipes and search with your pantry.
            </div>
          )}
        </div>
      </div>

      <section className="recipeSearchSticky" aria-label="Search and actions">
        <div className="recipeSearchBar">
          <div className="controlsTop">
            <div className="seg">
              <button
                className={`segBtn ${mode === "name" ? "active" : ""}`}
                onClick={() => setMode("name")}
                type="button"
              >
                By name
              </button>
              <button
                className={`segBtn ${mode === "ingredient" ? "active" : ""}`}
                onClick={() => setMode("ingredient")}
                type="button"
              >
                By ingredient
              </button>
            </div>

            <div className="filters filtersDesktop">
              <div className="filterItem">
                <label className="small muted">Area</label>
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.currentTarget.value)}
                  className="select"
                >
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a === "any" ? "Any area" : a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filterItem">
                <label className="small muted">Sort</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.currentTarget.value as "match" | "fast" | "calories")}
                  className="select"
                >
                  <option value="match">Best match</option>
                  <option value="fast">Fastest</option>
                  <option value="calories">Calories</option>
                </select>
              </div>
              <div className="filterItem">
                <label className="small muted">Diet</label>
                <select
                  value={diet}
                  onChange={(e) =>
                    setDiet(
                      e.currentTarget.value as
                        | "any"
                        | "vegetarian"
                        | "vegan"
                        | "pescetarian"
                        | "gluten free"
                        | "ketogenic"
                    )
                  }
                  className="select"
                >
                  <option value="any">Any</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="pescetarian">Pescetarian</option>
                  <option value="gluten free">Gluten Free</option>
                  <option value="ketogenic">Ketogenic</option>
                </select>
              </div>
              <div className="filterItem">
                <label className="small muted">Max time</label>
                <select
                  value={maxTime ?? ""}
                  onChange={(e) =>
                    setMaxTime(e.currentTarget.value ? Number(e.currentTarget.value) : null)
                  }
                  className="select"
                >
                  <option value="">Any</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                </select>
              </div>
            </div>

            {isSignedIn ? (
              <div className="actionsRow">
                <button
                  className="btn-base btn--secondary btn--md filtersMobile"
                  type="button"
                  onClick={() => setShowFilters(true)}
                >
                  Filters
                </button>
                <Button variant="secondary" onClick={() => setShowPantryPicker(true)}>
                  Find with my pantry
                </Button>
                <Button onClick={() => setShowWizard(true)}>Create recipe</Button>
              </div>
            ) : (
              <div className="actionsRow">
                <button
                  className="btn-base btn--secondary btn--md filtersMobile"
                  type="button"
                  onClick={() => setShowFilters(true)}
                >
                  Filters
                </button>
              </div>
            )}
          </div>

          {mode === "name" ? (
            <div className="recipeSearchRow">
              <input
                aria-label="Search"
                type="text"
                value={q}
                onChange={(e) => setQ(e.currentTarget.value)}
                placeholder="Search recipes by name..."
              />
              <button
                className="btn-base btn--secondary btn--md"
                type="button"
                onClick={() => setQ("")}
                disabled={!q.trim()}
              >
                Clear
              </button>
            </div>
          ) : (
            <IngredientSearch
              value={ingredientValue}
              ingredients={ingredientChips}
              onValueChange={setIngredientValue}
              onIngredientsChange={setIngredientChips}
              onSearch={runIngredientSearch}
              isLoading={busySearch}
              maxIngredients={10}
            />
          )}

          {busySearch && <p className="muted small">Searching…</p>}
          {err && <p className="error">{err}</p>}
          {pantryRecipes && <p className="muted small">Showing suggestions from your pantry.</p>}
        </div>
      </section>

      {showFilters && (
        <div className="filtersSheet" role="dialog" aria-modal>
          <button
            className="filtersBackdrop"
            type="button"
            onClick={() => setShowFilters(false)}
            aria-label="Close filters"
          />
          <div className="filtersPanel">
            <div className="filtersHeader">
              <strong>Filters</strong>
              <button className="btn-base btn--ghost btn--sm" type="button" onClick={() => setShowFilters(false)}>
                Close
              </button>
            </div>
            <div className="filtersGrid">
              <label>
                <span className="small muted">Area</span>
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.currentTarget.value)}
                  className="select"
                >
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a === "any" ? "Any area" : a}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="small muted">Sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.currentTarget.value as "match" | "fast" | "calories")}
                  className="select"
                >
                  <option value="match">Best match</option>
                  <option value="fast">Fastest</option>
                  <option value="calories">Calories</option>
                </select>
              </label>
              <label>
                <span className="small muted">Diet</span>
                <select
                  value={diet}
                  onChange={(e) =>
                    setDiet(
                      e.currentTarget.value as
                        | "any"
                        | "vegetarian"
                        | "vegan"
                        | "pescetarian"
                        | "gluten free"
                        | "ketogenic"
                    )
                  }
                  className="select"
                >
                  <option value="any">Any</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="pescetarian">Pescetarian</option>
                  <option value="gluten free">Gluten Free</option>
                  <option value="ketogenic">Ketogenic</option>
                </select>
              </label>
              <label>
                <span className="small muted">Max time</span>
                <select
                  value={maxTime ?? ""}
                  onChange={(e) =>
                    setMaxTime(e.currentTarget.value ? Number(e.currentTarget.value) : null)
                  }
                  className="select"
                >
                  <option value="">Any</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                </select>
              </label>
            </div>
            <div className="filtersActions">
              <button
                className="btn-base btn--secondary btn--md"
                type="button"
                onClick={() => {
                  setAreaFilter("any");
                  setSortBy("match");
                  setDiet("any");
                  setMaxTime(null);
                }}
              >
                Reset
              </button>
              <button className="btn-base btn--primary btn--md" type="button" onClick={() => setShowFilters(false)}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="list">
        {isLoading ? (
          <RecipeSkeletons />
        ) : err ? (
          <div className="alert-error errorCard">
            <div>{err}</div>
            <button className="btn-base btn--secondary btn--md" type="button" onClick={retrySearch}>
              Retry
            </button>
          </div>
        ) : visibleRecipes.length === 0 ? (
          <div className="emptyState">
            <h3>No recipes found</h3>
            <p>No recipes found — try fewer ingredients.</p>
            <button className="btn-base btn--secondary btn--md" type="button" onClick={clearSearch}>
              Clear search
            </button>
          </div>
        ) : (
          <div className="recipeGrid">
            {visibleRecipes.map((r) => {
              const key = `${r.source}-${r.id}`;
              const imageKey = `${r.source}-${r.id}`;
              const hasImageError = imageErrors[imageKey];

              const baseImage = getRecipeImage(r) ?? getRecipePlaceholder(r.title);
              const imageUrl = hasImageError ? "/placeholder.png" : baseImage;
              const minutes = getRecipeMinutes(r);
              const servings = getRecipeServings(r);
              const isMine = r.source === "user" && !!me && r.author?.uid === me;
              const editHref = isMine ? `/profile/recipes/${r.id}` : undefined;

              return (
                <article key={key} className="recipeCard">
                  <div className="recipeMedia">
                    <Image
                      src={imageUrl}
                      alt={r.title}
                      fill
                      sizes="(max-width: 768px) 90vw, 300px"
                      className="recipeImg"
                      onError={() => {
                        if (hasImageError) return;
                        setImageErrors((prev) => ({ ...prev, [imageKey]: true }));
                      }}
                    />
                  </div>

                  <div className="recipeBody">
                    <div className="recipeTitleRow">
                      <h3 className="recipeTitle">{r.title}</h3>
                    </div>

                    <div className="recipeMeta">
                      {typeof minutes === "number" ? (
                        <span className="recipePill">{minutes} min</span>
                      ) : null}
                      {typeof servings === "number" ? (
                        <span className="recipePill">{servings} servings</span>
                      ) : null}
                      {typeof r.calories === "number" ? (
                        <span className="recipePill">{Math.round(r.calories)} kcal</span>
                      ) : null}
                      {r.area ? <span className="recipePill">{r.area}</span> : null}
                      {r.category ? <span className="recipePill">{r.category}</span> : null}
                    </div>

                    <div className="recipeActions">
                      {r.source !== "user" ? (
                        <SaveRecipeButton
                          recipe={{
                            id: Number(r.id),
                            title: r.title,
                            image: imageUrl,
                            readyInMinutes: minutes ?? null,
                            servings: servings ?? null,
                          }}
                          source="themealdb"
                          variant="secondary"
                        />
                      ) : null}
                      <button
                        className="recipeBtn recipeBtnPrimary"
                        type="button"
                        onClick={() => openRecipe(r)}
                      >
                        View
                      </button>
                      {editHref ? (
                        <Link className="recipeBtn" href={editHref}>
                          Edit
                        </Link>
                      ) : null}
                      <button
                        className={`recipeBtn recipeBtnShare${copiedId === r.id ? " recipeBtnShareDone" : ""}`}
                        type="button"
                        onClick={() => handleRecipeShare(r)}
                        title="Copy recipe link"
                      >
                        {copiedId === r.id ? "Copied!" : "Share"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {mode === "ingredient" && apiRecipes.length > 0 && apiRecipes.length < ingredientTotal ? (
        <div className="loadMoreRow">
          <button
            className="btn-base btn--secondary btn--md"
            type="button"
            onClick={() => runIngredientSearch(ingredientChips, false)}
            disabled={loadingMore || busySearch}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}

      {openModal ? (
        <RecipeModal
          recipe={openModal}
          onClose={() => setOpenModal(null)}
        />
      ) : null}

      {isSignedIn && showPantryPicker && (
        <PantryPicker
          open={showPantryPicker}
          onClose={() => setShowPantryPicker(false)}
          allItems={pantry}
          onSearch={runPantrySearch}
          busy={busySearch}
        />
      )}

      {isSignedIn && showWizard && (
        <CreateRecipeWizard
          open={showWizard}
          onClose={() => setShowWizard(false)}
          onSaved={() => {}}
          meUid={me}
        />
      )}

      <style jsx>{`
        .container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 20px 28px;
        }
        .topbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: end;
          margin-bottom: 18px;
          padding: 20px 22px;
          border-radius: 24px;
          border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
          background:
            radial-gradient(circle at top right, color-mix(in oklab, var(--primary) 14%, transparent), transparent 28%),
            linear-gradient(135deg, color-mix(in oklab, var(--bg2) 94%, transparent), color-mix(in oklab, var(--bg) 88%, var(--bg2) 12%));
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
        }
        .titleBlock {
          display: grid;
          gap: 6px;
          min-width: 0;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .title {
          font-size: clamp(30px, 3vw, 36px);
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.03em;
          color: var(--text);
        }
        .intro {
          margin: 0;
          max-width: 60ch;
          font-size: 14px;
          color: var(--muted);
        }
        .right {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .signinHint {
          font-size: 13px;
          line-height: 1.45;
          color: var(--text);
          background: color-mix(in oklab, var(--bg2) 92%, transparent);
          border: 1px dashed color-mix(in oklab, var(--primary) 24%, var(--border));
          padding: 10px 12px;
          border-radius: 14px;
          max-width: 320px;
        }
        .signinHint strong { color: var(--primary); }

        .controlsTop {
          display: grid;
          align-items: end;
          grid-template-columns: auto 1fr auto;
          gap: 14px;
        }
        @media (max-width: 980px) {
          .topbar {
            grid-template-columns: 1fr;
            align-items: start;
          }
          .right {
            justify-content: flex-start;
          }
          .controlsTop {
            grid-template-columns: 1fr;
          }
        }
        .actionsRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
        }
        @media (max-width: 980px) {
          .actionsRow {
            justify-content: flex-start;
          }
        }

        .filters {
          display: grid;
          gap: 4px;
          align-items: end;
        }
        .filtersDesktop {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        @media (max-width: 980px) {
          .filtersDesktop {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .filterItem {
          display: grid;
          gap: 4px;
        }
        .filtersMobile {
          display: none;
        }
        @media (max-width: 720px) {
          .container {
            padding: 18px 16px 24px;
          }
          .topbar {
            padding: 18px;
            margin-bottom: 14px;
            border-radius: 20px;
          }
          .title {
            font-size: 28px;
          }
          .intro {
            font-size: 13px;
          }
          .filtersDesktop {
            display: none;
          }
          .filtersMobile {
            display: inline-flex;
          }
        }
        .select {
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px 10px;
          background: var(--bg2);
          color: var(--text);
        }
        .linkBtn {
          border: none;
          background: none;
          color: var(--text);
          text-decoration: underline;
          cursor: pointer;
          font-size: 13px;
        }

        .seg {
          display: inline-grid;
          grid-auto-flow: column;
          gap: 0;
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--bg2);
        }
        .segBtn {
          padding: 10px 12px;
          font-weight: 700;
          border: 0;
          background: transparent;
          color: var(--text);
          cursor: pointer;
        }
        .segBtn + .segBtn {
          border-left: 1px solid var(--border);
        }
        .segBtn.active {
          background: var(--primary);
          color: var(--primary-contrast);
        }

        .muted {
          color: var(--muted);
        }
        .small {
          font-size: 12px;
        }
        .error {
          margin-top: 8px;
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
        }
        .errorCard {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px;
        }
        .emptyState {
          border: 1px dashed var(--border);
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          background: var(--bg-raised);
          box-shadow: var(--shadow);
        }
        .emptyState h3 {
          margin: 0 0 6px;
          color: var(--text);
        }
        .emptyState p {
          margin: 0;
          color: var(--muted);
        }
        .emptyState button {
          margin-top: 12px;
        }

        .list {
          margin-top: 12px;
        }
        .loadMoreRow {
          display: flex;
          justify-content: center;
          margin: 18px 0 6px;
        }
        .filtersSheet {
          position: fixed;
          inset: 0;
          display: grid;
          align-items: end;
          z-index: 1800;
        }
        .filtersBackdrop {
          position: absolute;
          inset: 0;
          background: rgba(2, 6, 23, 0.55);
          border: 0;
        }
        .filtersPanel {
          position: relative;
          background: var(--bg-raised);
          border-radius: 20px 20px 0 0;
          border: 1px solid var(--border);
          padding: 16px;
          box-shadow: 0 -18px 40px rgba(15, 23, 42, 0.18);
        }
        .filtersHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .filtersGrid {
          display: grid;
          gap: 12px;
        }
        .filtersGrid label {
          display: grid;
          gap: 6px;
        }
        .filtersActions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 14px;
        }
        @media (min-width: 721px) {
          .filtersSheet {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}
