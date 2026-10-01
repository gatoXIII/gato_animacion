# Epsilon — Bloque contractual (EPS-001)

Módulo: `src/math/Epsilon.js`
Dependencias: ninguna.
Prohibiciones: el valor NO es configurable en runtime. NO se reasigna.
              NO se usa como umbral de "asentamiento" en SpringSolver
              (que tiene umbrales propios).

---

## EPS-001 · EPSILON_MATH (constante exportada)

- **Propósito**: Único punto de verdad para tolerancia numérica de la
  capa `math/` y para comparaciones geométricas en capas superiores
  (`AABB`, `Geometry`, `HitTester`).
- **Valor**: `1e-9`.
- **Naturaleza**: constante inmutable exportada. No es un objeto,
  no es configurable, no tiene setters.
- **Usos autorizados**:
  - `Matrix3x3.invert()` como umbral de invertibilidad
    (`|det| > EPSILON_MATH`).
  - `Transform.setPosition/setRotation/setScale` para decidir si
    el valor cambió y marcar dirty.
  - `AABB.contains`, `AABB.intersects` y operaciones geométricas
    que requieran tolerancia tras aritmética de punto flotante.
  - Tests como referencia de tolerancia.
- **Usos NO autorizados**:
  - `Vector2.equalsApprox` / `Matrix3x3.equalsApprox` NO lo usan
    por defecto. El caller debe pasar epsilon explícito.
  - `SpringSolver.isSettled` usa umbrales propios del solver.
- **Precondiciones**: ninguna (es una constante).
- **Postcondiciones**: el valor es `1e-9` en todo instante.
- **Invariantes**: inmutabilidad; unicidad; no-configurabilidad.
- **Errores**: ninguno.
- **Complejidad**: O(1) acceso.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A (es la tolerancia).
- **Casos límite**: N/A.
- **Dependencias**: ninguna.
- **Tests obligatorios**:
  - el valor exportado es `1e-9`;
  - el valor es `Number` finito;
  - intentar reasignar no afecta al valor leído (constante de módulo);
  - dos imports del módulo devuelven el mismo valor.
- **Ejemplo**: `import { EPSILON_MATH } from './Epsilon.js';`
- **Notas**: ADR-003-D1. Decisión vinculante. Reabrirla requiere
  nuevo ADR con CHANGE-ID.
- **Historial**: v3.0 + ADR-003.