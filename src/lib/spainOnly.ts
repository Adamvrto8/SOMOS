// Spanish that is standard in Spain but not in Mexico, with the Mexican word (CLAUDE.md §1). One list for the data
// validator (scripts/validate-data.ts) and SOMO's answer check (src/lib/assistant/answerCheck.ts).

export const SPAIN_ONLY = new Map([
  ['coche', 'carro'],
  ['coches', 'carros'],
  ['ordenador', 'computadora'],
  ['móvil', 'celular'],
  ['zumo', 'jugo'],
  ['patata', 'papa'],
  ['patatas', 'papas'],
  ['conducir', 'manejar'],
  ['coger', 'tomar / agarrar'],
  ['gafas', 'lentes'],
  ['bolígrafo', 'pluma'],
  ['aparcar', 'estacionar'],
  ['billete', 'boleto'],
  ['billetes', 'boletos'],
])
export const VOSOTROS_WORDS = new Set(['vosotros', 'vosotras', 'os', 'sois', 'vais'])
export const VOSOTROS_ENDING = /(áis|éis|asteis|isteis)$/
/** Numbers that happen to end like a vosotros form. */
export const NOT_VOSOTROS = new Set(['dieciséis', 'veintiséis'])
