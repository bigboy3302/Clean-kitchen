# 🥗 Clean-Kitchen

**Clean-Kitchen** ir viedās virtuves asistenta tīmekļa aplikācija, kas ļauj uzturēt virtuves krājumus, saņemt receptes no esošajiem produktiem un sekot līdzi derīguma termiņiem.

---

## 🚀 Kā palaist projektu uz jauna datora

Šie soļi derēs, ja piesēdies pie **skolas datora** vai citas vietas un vēlies turpināt darbu ar projektu.

### 1. Klonē repozitoriju
```bash
git clone https://github.com/<tavs-github-username>/Clean-kitchen.git
cd Clean-kitchen
2. Pārliecinies, ka Node.js ir uzinstalēts
Lejupielādē Node.js LTS (>=20): https://nodejs.org/en/download

Pārbaudi:

bash
Copy code
node -v
npm -v
3. Instalē atkarības
bash
Copy code
npm install
4. Izveido .env.local failu
Projekta saknē (blakus package.json) izveido failu ar nosaukumu .env.local un ielīmē Firebase konfigurāciju:

env
Copy code
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=clean-kitchen-de925
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=clean-kitchen-de925.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
👉 Šīs vērtības var atrast Firebase Console → Project Settings → Your apps (Web app config).
(Failu .env.local GitHub neglabājas, tāpēc tas jāsagatavo pašam uz katra datora.)

5. Startē lokālo serveri
bash
Copy code
npm run dev
Atver pārlūkā → http://localhost:3000

✅ Ātrie atgādinājumi
Ja met kļūdas → notīri Next.js kešu un pārstartē:

bash
Copy code
rd /s /q .next   # Windows
rm -rf .next     # Mac/Linux
npm run dev
Vienmēr strādā no tās mapes, kur atrodas package.json un app/.

Ja Firebase nelādējas, pārbaudi, vai .env.local ir ielikts pareizi.

📂 Projekta struktūra (galvenās mapes)
bash
Copy code
app/                  → Next.js app router
  layout.tsx          → Globālais layouts
  page.tsx            → Sākumlapa (redirect uz /dashboard)
  dashboard/page.tsx  → Dashboard lapa
  auth/               → Login / Register lapas
components/           → UI komponenti
lib/                  → Firebase konfigurācija
styles/               → globals.css (Tailwind)
🔥 Firebase Deploy (ja gribi palaist tiešsaistē)
1. Firebase CLI uzstādīšana
bash
Copy code
npm install -g firebase-tools
firebase login
2. Inicializācija (tikai vienreiz projektā)
bash
Copy code
firebase init
Atzīmē: Firestore, Storage, (ja vajag arī Hosting).

Izvēlies savu projektu: clean-kitchen-de925.

Atstāj noklusētos failu nosaukumus (firestore.rules, storage.rules).

3. Deploy uz Firebase
bash
Copy code
firebase deploy
Pēc deploy Firebase dos URL, piemēram:

arduino
Copy code
https://clean-kitchen-de925.web.app