import { Vector2 } from '../math/Vector2.js';
import { AABB } from '../math/AABB.js';
import { EPSILON_MATH } from '../math/Epsilon.js';
import { CommandType } from './CommandType.js';
import { InvalidPathError } from '../errors/InvalidPathError.js';

const MAX_RECURSION_DEPTH = 24;

// Validadores internos de comandos
function validateCommandShape(cmd, index) {
  if (!cmd || typeof cmd !== 'object') {
    throw new InvalidPathError({
      functionId: 'PATH-001',
      input: { command: cmd, index },
      prevState: null,
      cause: 'command must be an object'
    });
  }
  if (!Object.isFrozen(cmd)) {
    throw new InvalidPathError({
      functionId: 'PATH-001',
      input: { command: cmd, index },
      prevState: null,
      cause: 'command must be frozen (ADR-004-D1)'
    });
  }
  const validTypes = [
    CommandType.MOVE_TO, CommandType.LINE_TO, CommandType.QUADRATIC_TO,
    CommandType.CUBIC_TO, CommandType.CLOSE
  ];
  if (!validTypes.includes(cmd.type)) {
    throw new InvalidPathError({
      functionId: 'PATH-001',
      input: { command: cmd, index },
      prevState: null,
      cause: `unrecognized command type: ${cmd.type}`
    });
  }
  // Validar params por tipo
  switch (cmd.type) {
    case CommandType.MOVE_TO:
    case CommandType.LINE_TO:
      assertFinite(cmd.x, `${cmd.type}.x`, cmd, index);
      assertFinite(cmd.y, `${cmd.type}.y`, cmd, index);
      break;
    case CommandType.QUADRATIC_TO:
      assertFinite(cmd.cx, `${cmd.type}.cx`, cmd, index);
      assertFinite(cmd.cy, `${cmd.type}.cy`, cmd, index);
      assertFinite(cmd.x, `${cmd.type}.x`, cmd, index);
      assertFinite(cmd.y, `${cmd.type}.y`, cmd, index);
      break;
    case CommandType.CUBIC_TO:
      assertFinite(cmd.c1x, `${cmd.type}.c1x`, cmd, index);
      assertFinite(cmd.c1y, `${cmd.type}.c1y`, cmd, index);
      assertFinite(cmd.c2x, `${cmd.type}.c2x`, cmd, index);
      assertFinite(cmd.c2y, `${cmd.type}.c2y`, cmd, index);
      assertFinite(cmd.x, `${cmd.type}.x`, cmd, index);
      assertFinite(cmd.y, `${cmd.type}.y`, cmd, index);
      break;
    case CommandType.CLOSE:
      // Sin params adicionales
      break;
  }
}

function assertFinite(value, name, cmd, index) {
  if (!Number.isFinite(value)) {
    throw new InvalidPathError({
      functionId: 'PATH-001',
      input: { command: cmd, index },
      prevState: null,
      cause: `${name} must be a finite number, got ${value}`
    });
  }
}

function hasActiveSubpath(commands) {
  if (commands.length === 0) return false;
  const last = commands[commands.length - 1];
  // CLOSE cierra el subpath; después de CLOSE no hay subpath activo
  // hasta un nuevo MOVE_TO
  if (last.type === CommandType.CLOSE) return false;
  // Cualquier otro tipo deja subpath activo
  return true;
}

// Distancia de un punto a una línea definida por dos puntos
function pointToLineDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < EPSILON_MATH * EPSILON_MATH) {
    // Línea degenerada (P0 ≈ P3): distancia euclidiana al punto
    const ex = px - x1;
    const ey = py - y1;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const num = Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1);
  return num / Math.sqrt(lenSq);
}

// Elevar cuadrática a cúbica
function elevateQuadraticToCubic(p0x, p0y, qx, qy, p1x, p1y) {
  const c1x = p0x + (2 / 3) * (qx - p0x);
  const c1y = p0y + (2 / 3) * (qy - p0y);
  const c2x = p1x + (2 / 3) * (qx - p1x);
  const c2y = p1y + (2 / 3) * (qy - p1y);
  return { c1x, c1y, c2x, c2y };
}

// Acumulador de extremos
class BoundsAccumulator {
  constructor() {
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    this.hasPoints = false;
  }
  addPoint(x, y) {
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;
    this.hasPoints = true;
  }
  toAABB() {
    if (!this.hasPoints) {
      return AABB.empty();
    }
    return new AABB(this.minX, this.minY, this.maxX, this.maxY);
  }
}

// Subdivisión adaptativa De Casteljau para segmento cúbico
// ADR-004-D4: corte fijo en t=0.5, tolerancia EPSILON_MATH, MAX_RECURSION_DEPTH = 24
function subdivideCubic(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, acc, depth) {
  if (depth > MAX_RECURSION_DEPTH) {
    // Silencio total: NO emitir advertencia en consola.
    // El resultado sigue siendo válido (se agregan los 4 puntos).
    acc.addPoint(p0x, p0y);
    acc.addPoint(p1x, p1y);
    acc.addPoint(p2x, p2y);
    acc.addPoint(p3x, p3y);
    return;
  }

  // Calcular flatness
  const d1 = pointToLineDistance(p1x, p1y, p0x, p0y, p3x, p3y);
  const d2 = pointToLineDistance(p2x, p2y, p0x, p0y, p3x, p3y);
  const flatness = Math.max(d1, d2);

  if (flatness <= EPSILON_MATH) {
    // Suficientemente plano: agregar extremos
    acc.addPoint(p0x, p0y);
    acc.addPoint(p3x, p3y);
    return;
  }

  // Dividir en t=0.5 usando De Casteljau
  const mx01 = (p0x + p1x) / 2;
  const my01 = (p0y + p1y) / 2;
  const mx12 = (p1x + p2x) / 2;
  const my12 = (p1y + p2y) / 2;
  const mx23 = (p2x + p3x) / 2;
  const my23 = (p2y + p3y) / 2;

  const mx012 = (mx01 + mx12) / 2;
  const my012 = (my01 + my12) / 2;
  const mx123 = (mx12 + mx23) / 2;
  const my123 = (my12 + my23) / 2;

  const mxMid = (mx012 + mx123) / 2;
  const myMid = (my012 + my123) / 2;

  // Mitad izquierda: P0, M01, M012, Mid
  subdivideCubic(p0x, p0y, mx01, my01, mx012, my012, mxMid, myMid, acc, depth + 1);
  // Mitad derecha: Mid, M123, M23, P3
  subdivideCubic(mxMid, myMid, mx123, my123, mx23, my23, p3x, p3y, acc, depth + 1);
}

export class Path {
  #commands;

  // PATH-001
  constructor(commands) {
    if (!Array.isArray(commands)) {
      throw new InvalidPathError({
        functionId: 'PATH-001',
        input: { commands },
        prevState: null,
        cause: 'commands must be an array'
      });
    }
    for (let i = 0; i < commands.length; i++) {
      validateCommandShape(commands[i], i);
    }
    // ADR-004-D2: copia el array, comparte referencias a comandos congelados
    this.#commands = [...commands];
  }

  // PATH-002
  moveTo(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new InvalidPathError({
        functionId: 'PATH-002',
        input: { x, y },
        prevState: { commandCount: this.#commands.length },
        cause: 'x and y must be finite numbers'
      });
    }
    this.#commands.push(Object.freeze({ type: CommandType.MOVE_TO, x, y }));
  }

  // PATH-003
  lineTo(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new InvalidPathError({
        functionId: 'PATH-003',
        input: { x, y },
        prevState: { commandCount: this.#commands.length },
        cause: 'x and y must be finite numbers'
      });
    }
    if (!hasActiveSubpath(this.#commands)) {
      throw new InvalidPathError({
        functionId: 'PATH-003',
        input: { x, y },
        prevState: { commandCount: this.#commands.length },
        cause: 'no active subpath; call moveTo first'
      });
    }
    this.#commands.push(Object.freeze({ type: CommandType.LINE_TO, x, y }));
  }

  // PATH-004
  quadraticTo(cx, cy, x, y) {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) ||
        !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new InvalidPathError({
        functionId: 'PATH-004',
        input: { cx, cy, x, y },
        prevState: { commandCount: this.#commands.length },
        cause: 'all parameters must be finite numbers'
      });
    }
    if (!hasActiveSubpath(this.#commands)) {
      throw new InvalidPathError({
        functionId: 'PATH-004',
        input: { cx, cy, x, y },
        prevState: { commandCount: this.#commands.length },
        cause: 'no active subpath; call moveTo first'
      });
    }
    this.#commands.push(Object.freeze({ type: CommandType.QUADRATIC_TO, cx, cy, x, y }));
  }

  // PATH-005
  cubicTo(c1x, c1y, c2x, c2y, x, y) {
    if (!Number.isFinite(c1x) || !Number.isFinite(c1y) ||
        !Number.isFinite(c2x) || !Number.isFinite(c2y) ||
        !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new InvalidPathError({
        functionId: 'PATH-005',
        input: { c1x, c1y, c2x, c2y, x, y },
        prevState: { commandCount: this.#commands.length },
        cause: 'all parameters must be finite numbers'
      });
    }
    if (!hasActiveSubpath(this.#commands)) {
      throw new InvalidPathError({
        functionId: 'PATH-005',
        input: { c1x, c1y, c2x, c2y, x, y },
        prevState: { commandCount: this.#commands.length },
        cause: 'no active subpath; call moveTo first'
      });
    }
    this.#commands.push(Object.freeze({ type: CommandType.CUBIC_TO, c1x, c1y, c2x, c2y, x, y }));
  }

  // PATH-006
  close() {
    if (!hasActiveSubpath(this.#commands)) {
      throw new InvalidPathError({
        functionId: 'PATH-006',
        input: {},
        prevState: { commandCount: this.#commands.length },
        cause: 'no active subpath to close'
      });
    }
    this.#commands.push(Object.freeze({ type: CommandType.CLOSE }));
  }

  // PATH-007
  clone() {
    const cloned = new Path([]);
    // ADR-004-D2: copia el array, comparte comandos congelados
    cloned.#commands = [...this.#commands];
    return cloned;
  }

  // PATH-008
  isClosed() {
    if (this.#commands.length === 0) {
      return false;
    }
    // Identificar subpaths: secuencias desde MOVE_TO hasta siguiente MOVE_TO o final
    let currentSubpathHasClose = false;
    let allSubpathsClosed = true;
    let subpathCount = 0;

    for (let i = 0; i < this.#commands.length; i++) {
      const cmd = this.#commands[i];
      if (cmd.type === CommandType.MOVE_TO) {
        // Inicio de nuevo subpath
        if (subpathCount > 0 && !currentSubpathHasClose) {
          allSubpathsClosed = false;
        }
        subpathCount++;
        currentSubpathHasClose = false;
      } else if (cmd.type === CommandType.CLOSE) {
        currentSubpathHasClose = true;
      }
    }
    // Verificar el último subpath
    if (subpathCount > 0 && !currentSubpathHasClose) {
      allSubpathsClosed = false;
    }

    return subpathCount > 0 && allSubpathsClosed;
  }

  // PATH-009
  segmentCount() {
    let count = 0;
    for (const cmd of this.#commands) {
      if (cmd.type === CommandType.LINE_TO ||
          cmd.type === CommandType.QUADRATIC_TO ||
          cmd.type === CommandType.CUBIC_TO) {
        count++;
      }
    }
    return count;
  }

  // PATH-010
  validate() {
    // NO repara datos. Solo inspecciona.
    for (let i = 0; i < this.#commands.length; i++) {
      validateCommandShape(this.#commands[i], i);
    }
    // Verificar coherencia estructural: lineTo/quadraticTo/cubicTo/close requieren subpath activo
    let activeSubpath = false;
    for (let i = 0; i < this.#commands.length; i++) {
      const cmd = this.#commands[i];
      if (cmd.type === CommandType.MOVE_TO) {
        activeSubpath = true;
      } else if (cmd.type === CommandType.CLOSE) {
        if (!activeSubpath) {
          throw new InvalidPathError({
            functionId: 'PATH-010',
            input: { commandIndex: i, type: cmd.type },
            prevState: null,
            cause: 'CLOSE without active subpath'
          });
        }
        activeSubpath = false;
      } else {
        // LINE_TO, QUADRATIC_TO, CUBIC_TO
        if (!activeSubpath) {
          throw new InvalidPathError({
            functionId: 'PATH-010',
            input: { commandIndex: i, type: cmd.type },
            prevState: null,
            cause: `${cmd.type} without active subpath`
          });
        }
      }
    }
  }

  // PATH-011
  getBounds() {
    if (this.#commands.length === 0) {
      return AABB.empty();
    }

    const acc = new BoundsAccumulator();
    let currentX = 0;
    let currentY = 0;
    let hasCurrent = false;

    for (let i = 0; i < this.#commands.length; i++) {
      const cmd = this.#commands[i];
      switch (cmd.type) {
        case CommandType.MOVE_TO:
          currentX = cmd.x;
          currentY = cmd.y;
          hasCurrent = true;
          acc.addPoint(currentX, currentY);
          break;
        case CommandType.LINE_TO:
          if (!hasCurrent) {
            // No debería ocurrir en Path válido, pero defensa
            currentX = cmd.x;
            currentY = cmd.y;
            hasCurrent = true;
          }
          acc.addPoint(currentX, currentY);
          acc.addPoint(cmd.x, cmd.y);
          currentX = cmd.x;
          currentY = cmd.y;
          break;
        case CommandType.QUADRATIC_TO: {
          if (!hasCurrent) {
            currentX = cmd.x;
            currentY = cmd.y;
            hasCurrent = true;
          }
          const { c1x, c1y, c2x, c2y } = elevateQuadraticToCubic(
            currentX, currentY, cmd.cx, cmd.cy, cmd.x, cmd.y
          );
          subdivideCubic(currentX, currentY, c1x, c1y, c2x, c2y, cmd.x, cmd.y, acc, 0);
          currentX = cmd.x;
          currentY = cmd.y;
          break;
        }
        case CommandType.CUBIC_TO: {
          if (!hasCurrent) {
            currentX = cmd.x;
            currentY = cmd.y;
            hasCurrent = true;
          }
          subdivideCubic(
            currentX, currentY,
            cmd.c1x, cmd.c1y,
            cmd.c2x, cmd.c2y,
            cmd.x, cmd.y,
            acc, 0
          );
          currentX = cmd.x;
          currentY = cmd.y;
          break;
        }
        case CommandType.CLOSE:
          // CLOSE no aporta puntos geométricos nuevos
          break;
      }
    }

    return acc.toAABB();
  }
  // Método interno para BezierPath (no es parte del contrato público)
  // ADR-004 no exige getCommands(), pero BezierPath necesita leer los
  // comandos para construir segmentos cúbicos.
  _getCommandsForGeometry() {
    return this.#commands;
  }

    // PATH-012
  getCommands() {
    // ADR-004-D2: devuelve copia del array, comparte comandos congelados.
    return [...this.#commands];
  }
}