# Asistent (prototyp) – nastavenie

Stav: prototyp pre jeden účet, funkčný až po týchto krokoch. Spec: `docs/superpowers/specs/2026-11-15-chat-assistant-prototype-design.md`.

## 1. Anthropic API kľúč
1. V Anthropic Console vytvor API kľúč (workspace s nastaveným limitom výdavkov, napr. 5 USD mesačne).
2. Vo Vercel (Project → Settings → Environment Variables, Production) pridaj `ANTHROPIC_API_KEY`.

## 2. Zoznam povolených účtov
Vo Vercel pridaj `CHAT_ALLOWED_USERS` = tvoje id z Supabase → Authentication → Users (odporúčané, e-mail sa môže zmeniť; funguje aj e-mail z prihlásenia do SOMOS), viac hodnôt oddeľ čiarkou.

## 3. Voliteľné
- `CHAT_DAILY_CALLS` – denný strop volaní modelu pre všetkých (predvolene 200).
- `CHAT_MODEL` – iný model než `claude-haiku-5-5`. Haiku 5.5 je už najlacnejší aktuálny model, takže výmena porovnáva kvalitu (napr. `claude-sonnet-5-5`), nie nižšiu cenu.

Zmena premenných vo Verceli sa prejaví až po novom nasadení (redeploy).

## 4. Supabase
V SQL editore spusti nový blok z `supabase/schema.sql` (od komentára „Assistant (api/chat.ts)“): tabuľka `chat_usage` a funkcia `chat_calls_today()`. Supabase premenné (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) už vo Verceli sú.

Pre 👍 / 👎 pod odpoveďami (2026-11-18) spusti aj blok „Assistant feedback“ z konca `supabase/schema.sql`: tabuľka
`chat_feedback`, do ktorej prihlásený učiaci vkladá len vlastné riadky a cez API ju nikto nečíta. Hodnotenia sú v
Supabase → Table Editor → `chat_feedback`. Kým tabuľka nie je, pod odpoveďou sa po ťuknutí ukáže „Hodnotenie sa
nepodarilo odoslať“.

## 5. Nasadenie a skúška
Zmena env premenných vo Verceli platí až po redeployi.

Po pushi a zelenom CI: v appke Profil → 7 ťukov na verziu → Nástroje pre vývoj → „Otvoriť asistenta“, prihlásený. Napíš „Ako sa povie dom?“; očakávaš odpoveď s odkazom na slovo `casa`.

`vercel.json` obsahuje `"api/chat.ts": { "maxDuration": 30 }` (volanie Anthropic má vlastný timeout 22 s), vedľa existujúceho `api/reminder.ts`.

## 6. Čo sa meria
Každé volanie modelu je riadok v `chat_usage`. Náklad otázky:

```sql
-- priemer tokenov na otázku za posledných 7 dní (otázka = volanie, ktoré neskončilo tool_use)
select count(*) filter (where stop_reason <> 'tool_use') as questions,
       round(sum(input_tokens)::numeric / nullif(count(*) filter (where stop_reason <> 'tool_use'), 0)) as input_per_question,
       round(sum(output_tokens)::numeric / nullif(count(*) filter (where stop_reason <> 'tool_use'), 0)) as output_per_question,
       round(sum(cache_read_tokens)::numeric / nullif(sum(input_tokens + cache_read_tokens + cache_creation_tokens), 0), 2) as cache_share
from public.chat_usage
where at > now() - interval '7 days';
```

Cenu preraz podľa aktuálneho cenníka modelu (Anthropic pricing) × tokeny. `cache_share` > 0 znamená, že prompt caching sa uplatňuje.

## 6a. Čo appka posiela s otázkou
Okrem konverzácie ide s každou otázkou `context`:
- `app`: mapa appky (src/lib/assistant/appMap.ts): obrazovky (appGuide.ts), cvičenia, témy, gramatické tipy s id, počty obsahu, čo je dostupné. Rovnaká pre všetky otázky, preto sa cachuje (`cache_share` v `chat_usage`).
- `learner`: profil učiaceho (src/lib/assistant/learner.ts, zo zariadenia ho číta context.ts): nastavenia, dnešok, séria, kartičky, úspešnosť podľa cvičení, najčastejšie chyby, Cesta, testy, posledné zápisy z denníka (skrátené). Necachuje sa.
Podrobnosti si model vyžiada nástrojom `get_my_records`: chyby, výsledky testov a lekcií, uložené a vlastné slová (aj s vlastnými poznámkami) a zápisy z denníka vrátane španielskych viet o dni (každé pole skrátené na 300 znakov, najviac 20 záznamov).

Pred verejným spustením: profil a tieto záznamy (aj denník a poznámky k vlastným slovám) odchádzajú do Anthropic, treba to uviesť v ochrane súkromia. Text mapy dnes posiela appka a server ho len obmedzí veľkosťou (20 000 znakov); pre verejnú verziu ho má server skladať sám (pri builde), aby cudzí klient nemohol meniť inštrukcie modelu.
Nová obrazovka v src/App.tsx potrebuje sekciu v appGuide.ts, inak appGuide.test.ts zlyhá.

## 7. Vypnutie
Odober `ANTHROPIC_API_KEY` alebo `CHAT_ALLOWED_USERS` vo Verceli; funkcia potom vráti `not-configured` / `not-allowed`.
