# 🥗 Clean-Kitchen

**Clean-Kitchen** ir viedās virtuves asistenta tīmekļa aplikācija, kas ļauj:
- 📦 Uzturēt virtuves krājumus  
- 🍳 Saņemt receptes no esošajiem produktiem  
- ⏰ Sekot līdzi derīguma termiņiem  
- 🏋️‍♂️ Sekot līdzi trniņu grafikiem
- 👀 Izveido savā stilā tīmekļa vietni

---

## 🚀 Kā palaist projektu uz jauna datora

Šie soļi derēs, ja piesēdies pie **skolas datora** vai citas vietas un vēlies turpināt darbu ar projektu.

### 1️⃣ Klonē repozitoriju
```bash
git clone https://github.com/<tavs-github-username>/Clean-kitchen.git
cd Clean-kitchen





--- 2️⃣ Pārbaudi, vai Node.js ir uzinstalēts

Lejupielādē Node.js LTS (>=20) → https://nodejs.org/en/download

Pārbaudi versijas:

node -v
npm -v


---3️⃣ Instalē atkarības
npm install



---4️⃣ Izveido .env.local failu

Projekta saknē (blakus package.json) izveido failu .env.local un ielīmē Firebase konfigurāciju:

NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=clean-kitchen-de925
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=clean-kitchen-de925.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...


👉 Šīs vērtības atrodas: Firebase Console → Project Settings → Your apps (Web app config).
⚠️ .env.local netiek augšupielādēts GitHub, tāpēc to jāizveido pašam uz katra datora.




---5️⃣ Startē lokālo serveri
npm run dev
Atver pārlūkā → http://localhost:3000




---✅ Ātrie atgādinājumi

🔄 Ja met kļūdas, notīri Next.js kešu un pārstartē:

rd /s /q .next   # Windows
rm -rf .next     # Mac/Linux
npm run dev


📂 Vienmēr strādā no tās mapes, kur atrodas package.json un app/.

🔑 Ja Firebase nelādējas → pārbaudi .env.local saturu.



---📂 Projekta struktūra
app/                  → Next.js app router
  layout.tsx          → Globālais layouts
  page.tsx            → Sākumlapa (redirect uz /dashboard)
  dashboard/page.tsx  → Dashboard lapa
  auth/               → Login / Register lapas
components/           → UI komponenti
lib/                  → Firebase konfigurācija
styles/               → globals.css (Tailwind)



////////šis tiks darīts nakam nedeļ 13.10.2025
---🔥 Firebase Deploy (tiešsaistes versija)


---1️⃣ Firebase CLI uzstādīšana
npm install -g firebase-tools
firebase login


---2️⃣ Inicializācija (tikai pirmajā reizē projektā)
firebase init
Atzīmē: Firestore, Storage, (ja vajag — Hosting)
Izvēlies projektu: clean-kitchen-de925
Atstāj noklusētos failu nosaukumus (firestore.rules, storage.rules)



---3️⃣ Deploy uz Firebase
firebase deploy
Pēc deploy Firebase dos URL, piemēram:
https://clean-kitchen-de925.web.app




