# Clean Kitchen

Mūsdienīga viedās virtuves un fitnesa tīmekļa lietotne, kas veidota ar **Next.js**, **TypeScript** un **Firebase**.  
Clean Kitchen palīdz lietotājiem pārvaldīt pieliekamā produktus, samazināt pārtikas izšķērdēšanu, atrast receptes, sekot līdzi sastāvdaļām un izmantot fitnesa rīkus vienā platformā.

---

## Pārskats

Clean Kitchen tika izstrādāts kā skolas projekts ar mērķi risināt ikdienas virtuves organizēšanas problēmas, izmantojot pārskatāmu saskarni un praktiskas funkcijas. Lietotne apvieno pārtikas pārvaldību, receptes, plānošanu un fitnesa rīkus vienotā sistēmā.

Projekta galvenais mērķis ir palīdzēt lietotājiem:

- pārvaldīt pieliekamā un ledusskapja produktus
- sekot līdzi produktu derīguma termiņiem
- atrast receptes pēc pieejamajām sastāvdaļām
- efektīvāk organizēt ar pārtiku saistītās darbības
- izmantot papildu fitnesa un treniņu funkcijas

---

## Funkcionalitāte

### Virtuves un pieliekamā pārvaldība
- Pievienot produktus pieliekamajam un ledusskapim
- Sekot līdzi uzglabātajām sastāvdaļām
- Pārvaldīt daudzumus un kategorijas
- Uzraudzīt derīguma termiņus
- Samazināt pārtikas atkritumus, redzot, kurus produktus jāizlieto vispirms

### Receptes
- Pārlūkot receptes
- Izveidot un saglabāt receptes
- Skatīt recepšu detaļas
- Atrast gatavošanas idejas pēc pieejamajām sastāvdaļām

### Lietotāju sistēma
- Lietotāju autentifikācija ar Firebase
- Personīgie lietotāja dati un saglabātais saturs
- Profila funkcionalitāte
- Aizsargātas funkcijas autorizētiem lietotājiem

### Panelis
- Personalizēts galvenais panelis
- Pārskats par svarīgākajiem lietotāja datiem
- Ātra piekļuve pārtikas, recepšu un aktivitāšu funkcijām

### Fitnesa modulis
- Ar treniņiem saistītas lapas un komponenti
- Saglabāto treniņu funkcionalitāte
- Treniņu meklēšana un filtrēšana
- Papildu fitnesa rīki vienotā platformā

### Kopiena un saturs
- Ierakstu un kopienas lapas
- Lietotāju veidots saturs
- Satura pārlūkošana un mijiedarbība

### Papildu iespējas
- Svītrkodu skenēšanas bibliotēkas
- Firebase Cloud Functions atbalsts
- Firestore noteikumi un indeksi strukturētai backend loģikai

---

## Tehnoloģiju steks

### Frontend
- **Next.js 14**
- **React 18**
- **TypeScript**
- **CSS Modules**

### Backend un servisi
- **Firebase Authentication**
- **Cloud Firestore**
- **Firebase Storage**
- **Firebase Cloud Functions**

### Bibliotēkas un rīki
- **React Hook Form**
- **Zod**
- **Zustand**
- **TanStack Query**
- **Framer Motion**
- **ZXing** svītrkodu skenēšanas bibliotēkas

---

## Projekta struktūra

```bash
app/                    # Next.js App Router lapas un maršruti
components/             # Atkārtoti izmantojami UI un funkciju komponenti
hooks/                  # Pielāgoti React hooki
lib/                    # Firebase iestatījumi, palīgfunkcijas un biznesa loģika
functions/              # Firebase Cloud Functions
public/                 # Statiskie faili
styles/                 # Stilu faili, ja tiek izmantoti
firebase.json           # Firebase projekta konfigurācija
firestore.rules         # Firestore drošības noteikumi
firestore.indexes.json  # Firestore indeksi
storage.rules           # Firebase Storage noteikumi
```

---

## Instalēšana

### 1. Klonē repozitoriju

```bash
git clone https://github.com/bigboy3302/clean-kitchen.git
cd clean-kitchen
```

### 2. Instalē atkarības

```bash
npm install
```

### 3. Izveido vides mainīgo failu

Izveido projekta saknē failu `.env.local` un pievieno savu Firebase konfigurāciju.

Piemērs:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

Ja treniņu vai ārējo API funkcijām nepieciešamas papildu atslēgas, pievieno arī tās:

```env
RAPIDAPI_EXERCISE_KEY=your_rapidapi_key
RAPIDAPI_EXERCISE_HOST=your_rapidapi_host
```

---

## Projekta palaišana

Lai palaistu izstrādes serveri:

```bash
npm run dev
```

Atver projektu pārlūkā:

```bash
http://localhost:3000
```

---

## Pieejamie skripti

### Izstrāde

```bash
npm run dev
```

Palaiž lietotni izstrādes režīmā.

### Produkcijas būve

```bash
npm run build
```

Izveido produkcijai gatavu būvi.

### Produkcijas servera palaišana

```bash
npm run start
```

Palaiž uzbūvēto lietotni.

### Lint pārbaude

```bash
npm run lint
```

Pārbauda kodu ar lint noteikumiem.

### TypeScript pārbaude

```bash
npm run type-check
```

Palaiž TypeScript tipēšanas pārbaudi.

---

## Firebase iestatīšana

Šis projekts izmanto Firebase autentifikācijai, datu glabāšanai un backend loģikai.

### Izmantotie Firebase servisi

- Authentication
- Firestore
- Storage
- Cloud Functions

### Svarīgie Firebase faili

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`

### Firebase konfigurācijas izvietošana

Ja nepieciešams, izvieto Firebase noteikumus un indeksus:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

Lai izvietotu visu:

```bash
firebase deploy
```

Ja Firebase CLI nav autorizēts:

```bash
firebase login
```

---

## Cloud Functions

Projektā ir `functions/` mape Firebase Cloud Functions funkcionalitātei.

Tipisks iestatīšanas process:

```bash
cd functions
npm install
```

Lai izvietotu funkcijas:

```bash
firebase deploy --only functions
```

Cloud Functions var tikt izmantotas:

- automatizācijai
- fona apstrādei
- datubāzes trigeriem
- paplašinātai backend loģikai

---

## Workout API piezīmes

Projektā ir treniņu funkcionalitāte, un tajā var tikt izmantoti ārējie vingrojumu API.

Piemēri izmantotajiem maršrutiem:

- `GET /api/workouts/search`
- `GET /api/workouts/filters`
- `POST /api/saved-workouts`
- `GET /api/saved-workouts/me`
- `GET /api/saved-workouts/public`
- `DELETE /api/saved-workouts/:id`

### Prasības

- derīgi API piekļuves dati
- Firebase autentifikācija aizsargātām darbībām
- korekti Firestore noteikumi un indeksi

Ja lietotājs nav autorizēts, aizsargātie maršruti var atgriezt autorizācijas kļūdas.

---

## Svītrkodu skenera atbalsts

Projektā ir iekļautas svītrkodu skenēšanas bibliotēkas:

- `@zxing/browser`
- `@zxing/library`
- `react-zxing`

Šīs bibliotēkas paredzētas produktu skenēšanas funkcionalitātei, kur tā tiek izmantota.

---

## Projekta galvenais mērķis

Clean Kitchen mērķis ir izveidot praktisku full-stack tīmekļa lietotni, kas apvieno:

- pieliekamā pārvaldību
- recepšu atrašanu
- sastāvdaļu uzskaiti
- pārtikas organizēšanu
- fitnesa funkcionalitāti

Šis projekts demonstrē zināšanas par:

- full-stack lietotnes struktūru
- komponentu pieeju frontend izstrādē
- Firebase integrāciju
- maršrutu organizāciju Next.js vidē
- formu apstrādi un validāciju
- stāvokļa pārvaldību
- reāla projekta plānošanu

---

## Ekrāni un moduļi

Atkarībā no pašreizējās implementācijas projektā var būt iekļauti šādi moduļi:

- sākumlapa
- panelis
- pieliekamā un ledusskapja pārvaldība
- recepšu lapa
- receptes detalizētā lapa
- fitnesa lapa
- profila lapa
- ierakstu vai kopienas lapas
- saglabātie vai personalizētie skati

---

## Izstrādes piezīmes

Šis projekts tika izstrādāts kā skolas darbs un nākotnē vēl var tikt uzlabots.

Iespējamie uzlabojumi:

- labāka koda sakārtošana un refaktorēšana
- labāka komponentu sadalīšana
- stingrāka tipēšana
- UI/UX uzlabojumi
- plašāka recepšu un fitnesa funkcionalitāte
- sakārtotāka izvietošanas konfigurācija

---

## Zināmās uzlabojamās jomas

Tāpat kā daudzi studentu projekti, arī šo lietotni vēl var uzlabot vairākās jomās:

- koda bāzes sakārtošana
- neizmantoto failu un rezerves kopiju noņemšana
- ļoti lielu failu sadalīšana mazākos komponentos
- konsekventāka nosaukumu sistēma
- dublētas loģikas samazināšana
- README un dokumentācijas uzlabošana
- konfigurāciju un atkarību versiju saskaņošana

Šie uzlabojumi padarītu projektu vieglāk uzturamu un gatavāku produkcijas videi.

---

## Problēmu novēršana

### Firebase nestrādā

Pārliecinies, ka:

- `.env.local` fails eksistē
- visi Firebase dati ir pareizi
- Firebase projekts ir aktīvs un pieejams
- Firestore un Storage noteikumi ir izvietoti

### Būves kļūdas

Mēģini atkārtoti instalēt atkarības:

```bash
npm install
```

Notīri Next.js būves kešatmiņu:

```bash
rm -rf .next
```

Pēc tam palaid projektu vēlreiz:

```bash
npm run dev
```

### API vai treniņu dati netiek ielādēti

Pārbaudi:

- savu API atslēgu
- interneta savienojumu
- vai ārējais API serviss ir pieejams
- vai konkrētais maršruts prasa autentifikāciju

---

## Autors

Izstrādāts kā skolas projekts, izmantojot **Next.js**, **TypeScript** un **Firebase**.

---

## Licence

Šis projekts paredzēts izglītības nolūkiem.
