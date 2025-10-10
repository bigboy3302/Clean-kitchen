/**
 * Firebase Functions v2 starter (TypeScript)
 * Docs: https://firebase.google.com/docs/functions/typescript
 */

import { setGlobalOptions } from "firebase-functions/v2";      
import { onRequest } from "firebase-functions/v2/https";        
import * as logger from "firebase-functions/logger";           

// Limit concurrent containers (cost control)
setGlobalOptions({ maxInstances: 10 });

// Simple HTTPS function to verify everything works
export const helloWorld = onRequest((req, res) => {
  logger.info("Hello logs!", { structuredData: true });
  res.send("Hello from Firebase v2!");
});
