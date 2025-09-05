
export function stripUndefinedDeep(value) {
    if (Array.isArray(value)) {
      return value.map(stripUndefinedDeep);
    }
    if (value && typeof value === "object" && Object.prototype.toString.call(value) === "[object Object]") {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        if (v === undefined) continue;                  // drop undefined fields
        // keep Firestore sentinel values (like serverTimestamp functions) as-is
        out[k] = stripUndefinedDeep(v);
      }
      return out;
    }
    return value;
  }
  