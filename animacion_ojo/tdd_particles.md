# TDD Extensión — Partículas

## 0. Precedencia
Este documento extiende `tdd.md` v3.0. No puede contradecirlo (§73).
Si hay conflicto, gana `tdd.md`.

## 1. Motivo
`tdd.md` §1.16 y §49 exigen partículas como capacidad.
`tdd.md` §40.6 no especifica comando de render para partículas.
`primero.md` §20 listaba `DrawParticles` pero no es normativo.

## 2. Decisión de composición
[Una de A/B/C, con justificación arquitectónica.]

## 3. Módulo propietario
[Nuevo particles/ o animation/particles/ según decisión.]

## 4. Contratos de función
[FUNCTION-IDs, pre/post, mutaciones, errores, invariantes.]

## 5. Comando(s) de render
[Actualización propuesta a §40.6, con justificación de por qué
respeta §INV-009 y §PA-03.]

## 6. Invariantes
[Las de §49 + las nuevas.]

## 7. Pruebas
[Ciclo spawn→update→expire→remove, dt=0, dt máximo,
partícula expirada no renderiza, etc.]

## 8. Impacto en §69
[Insertar "particles" en el orden contractual antes de Etapa 14.]