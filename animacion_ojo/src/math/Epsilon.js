/**
 * Único punto de verdad para tolerancia numérica en la capa math/
 * y en comparaciones geométricas de capas superiores.
 *
 * ADR-003-D1:
 *   - Valor fijo: 1e-9.
 *   - No configurable en runtime.
 *   - No se usa como default en equalsApprox (el caller decide).
 *   - SpringSolver usa umbrales propios, no este valor.
 *
 * Reabrir esta decisión requiere un nuevo ADR con CHANGE-ID.
 */
export const EPSILON_MATH = 1e-9;