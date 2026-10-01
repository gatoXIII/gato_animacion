# ADR-002 — Resolución de conflictos primero.md vs tdd.md

Estado: Aceptado
Fecha: 2026-09-29
Autoridad: `tdd.md` v3.0 gana en todos los casos (§1.2 de agents.md).

## Regla
`primero.md` está marcado NO NORMATIVO. Las siguientes divergencias se
resuelven aplicando `tdd.md`. No se reabren.

## Tabla de resoluciones

| # | Tema | primero.md | tdd.md | Resolución | Módulo afectado |
|---|------|-----------|--------|-----------|-----------------|
| 1 | `SceneNode.render()` | §5.1 lo incluye conceptualmente | §15 no lo incluye; lo reemplaza por `buildRenderCommands(queue, context)` en nodos concretos (§16.3, §17.8, §18.5) | Gana `tdd.md`. `SceneNode` NO renderiza. El Scene Graph emite comandos; no dibuja. | `scenegraph/` |
| 2 | Laguna `DrawParticles` en tipos de comando | §20 lo lista como comando conceptual | §40.6 no lo incluye; §1.16 y §49 exigen partículas como capacidad | Bloqueada por §0.2. Se cerrará vía `tdd_particles.md` antes de la Etapa 14. No se implementa ni se promueve por iniciativa del agente. | `renderer/`, `particles/` (pendiente) |
| 3 | Ciclo de frame | §22 lo describe en bloques | §6 lo fija en fases F0–F14 con prohibiciones explícitas (§6.1) | Gana `tdd.md`. Fases F0..F14 obligatorias; prohibiciones de §6.1 aplican. | `engine/` |
| 4 | FUNCTION-IDs y checklist §72 | No los menciona | §4 y §72 los exigen para toda función pública y toda auxiliar que mute estado | Gana `tdd.md`. Bloque contractual completo obligatorio antes de código (§67). | global |
| 5 | TARGET vs CURRENT | No distingue explícitamente | §54 lo exige para toda propiedad animable | Gana `tdd.md`. Prohibido escribir `CURRENT = TARGET` para eliminar dinámica temporal. | `animation/`, `domain/` |
| 6 | Estados del Engine | §45 no enumera estados | §45 fija `CREATED \| RUNNING \| PAUSED \| STOPPED \| DESTROYED` | Gana `tdd.md`. Cinco estados cerrados. | `engine/` |
| 7 | Pseudo-3D | Mencionado como capacidad | §47 requisito funcional con operación contractual (`surface coords → orientation/yaw/tilt → projected → depth → visibility/scale`) | Gana `tdd.md`. Prohibido sustituir por translate 2D. | `character/` |
| 8 | Errores contractuales | §26 los enumera sin detalle | §55 los cierra con contexto obligatorio (`functionId`, `input`, `prevState`, `cause`) y prohíbe `catch-and-ignore` | Gana `tdd.md`. Clasificación cerrada de §55. | global |

## Nota sobre el ítem 2
La laguna de `DrawParticles` no es una contradicción resuelta, sino una
ausencia de especificación en `tdd.md §40.6`. Se documenta aquí para
dejar constancia de que no se implementa hasta que exista
`tdd_particles.md` aprobado.