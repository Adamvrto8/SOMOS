# Online preklad (DeepL) – limity

Všetci učiaci zdieľajú jeden kľúč DeepL (`DEEPL_API_KEY` vo Verceli). Aby ho jeden človek nevyčerpal, server
([`api/translate.ts`](../api/translate.ts)) má dve brzdy:

- **na učiaceho:** 30 vyhľadávaní za hodinu z jednej adresy (pri IPv6 celý blok /64) a 100 z väčšieho bloku
  (/24 pri IPv4, /48 pri IPv6). Potom appka povie „Hľadaní bolo priveľa, skús to o chvíľu.“
- **pre všetkých:** najviac `DEEPL_DAILY_CHARS` znakov za deň (UTC), predvolene 15 000, čo je mesačných
  500 000 znakov plánu Free rozdelených na 31 dní. Potom appka povie „Online preklad je dnes vyčerpaný, skús to
  zajtra.“

Opakované hľadanie toho istého si appka pamätá v zariadení, to nič nestojí. Keď Supabase nefunguje, preklad
ide ďalej bez bŕzd (vlastný limit DeepL platí stále).

## Nastavenie

1. Supabase → **SQL Editor** → vlož celý [`supabase/schema.sql`](../supabase/schema.sql) → **Run**
   („Success. No rows returned“). Pridá tabuľku `translate_budget`.
2. Nepovinné: vo Verceli (Settings → Environment Variables) premenná `DEEPL_DAILY_CHARS` s iným denným
   rozpočtom, napr. pri platenom DeepL. Po zmene treba nové nasadenie.

Koľko sa dnes minulo: v SQL Editore `select * from translate_budget order by day desc;`.
