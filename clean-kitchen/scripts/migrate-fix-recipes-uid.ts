/**
 * scripts/migrate-fix-recipes-uid.ts
 *
 * How to run:
 * 1) Create a Firebase service account key in the Console (Project Settings → Service accounts).
 * 2) Set env var:
 *      mac/linux: export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
 *      windows:   setx GOOGLE_APPLICATION_CREDENTIALS "C:\path\to\key.json"
 * 3) Install deps:
 *      npm i -D ts-node typescript
 *      npm i firebase-admin
 * 4) Run:
 *      npx ts-node scripts/migrate-fix-recipes-uid.ts
 */
import * as admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();

async function run() {
  const snap = await db.collection("recipes").get();
  let fixed = 0, skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as any;
    if (!data.uid) {
      const candidate = data?.author?.uid || data?.userId || null;
      if (candidate) {
        await doc.ref.update({ uid: candidate });
        fixed++;
      } else {
        console.log(`[skip] ${doc.id} has no uid/author.uid/userId – handle manually if needed`);
        skipped++;
      }
    }
  }

  console.log({ fixed, skipped });
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
