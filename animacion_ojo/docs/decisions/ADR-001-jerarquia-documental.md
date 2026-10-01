# ADR-001 — Jerarquía documental del motor

Estado: Aceptado
Fecha: 2026-09-29
Decisión tomada por: contrato maestro (tdd.md v3.0)

## Contexto
El motor convive con múltiples documentos de especificación y un baseline
histórico. Sin una jerarquía explícita, cualquier conflicto entre ellos
produciría implementaciones ambiguas o políticas silenciosas no autorizadas
(§0.2 de tdd.md).

## Decisión
Se establece la siguiente jerarquía de autoridad, de mayor a menor:

1. `tdd.md` v3.0 — contrato maestro cerrado. Autoridad absoluta.
2. `tdd.<extension>.md` — TDDs de extensión aprobados. Válido dentro de su
   alcance, sin contradecir tdd.md (§73).
3. `docs/decisions/ADR-*.md` — resoluciones de conflicto vinculantes.
4. `docs/contracts/<modulo>.md` — bloques contractuales derivados de tdd.md.
5. `primero.md` — baseline histórico. NO NORMATIVO. Sólo contexto.

## Reglas de precedencia
- Ante conflicto entre `tdd.md` y cualquier otro documento: gana `tdd.md`.
- Ante conflicto entre `tdd.md` y un TDD de extensión: gana `tdd.md`
  (un TDD inferior no puede reducir requisitos, §73).
- Ante conflicto entre `primero.md` y cualquier otro documento: gana el
  otro. `primero.md` está marcado NO NORMATIVO.
- No se reabren decisiones ya cerradas en ADR-*. Si una resolución se
  considera incorrecta, se reporta como bloqueo; no se modifica por
  iniciativa del agente.

## Lagunas (§0.2)
Toda capacidad exigida por `tdd.md` sin contrato completo se considera
bloqueada por especificación. El agente NO implementa, NO inventa, NO
promueve comandos conceptuales de `primero.md`. Espera actualización de
`tdd.md` o creación de un TDD de extensión. Cada laguna cerrada se
registra con CHANGE-ID en `CHANGELOG.md`.

## Consecuencias
- El agente codificador lee `agents.md`, `tdd.md`, ADR-001, ADR-002 y
  `tdd.md §69` antes de toda tarea.
- `primero.md` sólo se consulta como contexto histórico. Nunca se cita
  como fuente de contrato.
- Toda laguna se reporta y espera resolución explícita.