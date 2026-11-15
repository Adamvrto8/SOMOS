# Asistent (prototyp) – nastavenie

Stav: prototyp pre jeden účet, funkčný až po týchto krokoch. Spec: `docs/superpowers/specs/2026-11-15-chat-assistant-prototype-design.md`.

## 1. Anthropic API kľúč
1. V Anthropic Console vytvor API kľúč (workspace s nastaveným limitom výdavkov, napr. 5 USD mesačne).
2. Vo Vercel (Project → Settings → Environment Variables, Production) pridaj `ANTHROPIC_API_KEY`.

## 2. Zoznam povolených účtov
Vo Vercel pridaj `CHAT_ALLOWED_USERS` = tvoj e-mail z prihlásenia do SOMOS (alebo id z Supabase → Authentication → Users), viac hodnôt oddeľ čiarkou.

## 3. Voliteľné
- `CHAT_DAILY_CALLS` – denný strop volaní modelu pre všetkých (predvolene 200).
- `CHAT_MODEL` – iný model než `claude-haiku-5-5`, na porovnanie.

## 4. Supabase
V SQL editore spusti nový blok z `supabase/schema.sql` (od komentára „Assistant (api/chat.ts)“): tabuľka `chat_usage` a funkcia `chat_calls_today()`. Supabase premenné (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) už vo Verceli sú.

## 5. Nasadenie a skúška
Po pushi a zelenom CI: v appke Profil → 7 ťukov na verziu → Nástroje pre vývoj → „Otvoriť asistenta“, prihlásený. Napíš „Ako sa povie dom?“; očakávaš odpoveď s odkazom na slovo `casa`.

`vercel.json` obsahuje `"api/chat.ts": { "maxDuration": 30 }` (volanie Anthropic má vlastný timeout 25 s), vedľa existujúceho `api/reminder.ts`.

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

## 7. Vypnutie
Odober `ANTHROPIC_API_KEY` alebo `CHAT_ALLOWED_USERS` vo Verceli; funkcia potom vráti `not-configured` / `not-allowed`.
