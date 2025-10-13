import { setLogLevel } from "firebase/firestore";

if (typeof window !== "undefined") {
  setLogLevel("debug");
  console.log("[Firestore] debug logging enabled");
}
