# Pripomienky pre každé zariadenie – jednorazové nastavenie

Server doteraz pripomínal jedno zariadenie (Upstash). Nová verzia pripomína každé zariadenie, kde je pripomienka
zapnutá, a ukladá ich v Supabase. Treba urobiť kroky 1 a 2 **pred** nasadením novej verzie: stará verzia ich
ignoruje, nová bez nich hlási „Pripomienky ešte nie sú na serveri nastavené“. Trvá to asi 10 minút.

## 1. Tabuľky v Supabase

1. Supabase → projekt `somos` → **SQL Editor** → **New query**.
2. Z [`supabase/schema.sql`](../supabase/schema.sql) skopíruj **iba poslednú časť**, od riadku
   `-- Practice reminders, one row per device` po koniec súboru (celý súbor raz narazil na deadlock s Realtime).
3. **Run**. Má skončiť „Success. No rows returned“.
4. V **Table Editor** pribudnú `push_devices`, `push_gone`, `push_ticks`, `push_rate`. Sú zamknuté: appka ani
   prihlásení používatelia ich nevidia, číta ich len funkcia na Verceli.

## 2. Tajný kľúč na Verceli

1. Supabase → **Project Settings → API Keys**: skopíruj tajný kľúč, **secret** (`sb_secret_…`), alebo starší
   **service_role**.
2. Vercel → projekt somos → **Settings → Environment Variables** → pridaj:
   - Key: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: ten kľúč
   - Environments: Production (a Preview, ak chceš skúšať aj tam)

   Nikdy nie s predponou `VITE_`: tá by ho dala do appky v telefóne, a s ním sa dá čítať a meniť všetko.
3. Adresa projektu sa berie z `VITE_SUPABASE_URL`, ktorá tam už je. Nič viac netreba.

## 3. Nasadenie a kontrola

1. Povedz mi, že kroky 1 a 2 sú hotové: pushnem novú verziu (Vercel ju nasadí sám, tým sa načítajú aj
   nové premenné).
2. Na telefóne otvor SOMOS. Pri štarte sa zariadenie samo prihlási na novom serveri.
3. Profil → vývojársky režim → Pripomienka → **Stav pripomienky**: má písať
   „Server pozná toto zariadenie, pripomienka o …“. Pošli skúšobnú notifikáciu.
4. V Supabase **Table Editor → push_devices** uvidíš riadok svojho telefónu.
5. cron-job.org netreba meniť: volá tú istú adresu s tým istým `CRON_SECRET`.

## 4. Upratanie (po dni, keď pripomienky chodia)

Vercel → **Storage** → Upstash → odpoj od projektu (alebo zmaž). Premenné `KV_REST_API_*` /
`UPSTASH_REDIS_REST_*` nová verzia nečíta.
