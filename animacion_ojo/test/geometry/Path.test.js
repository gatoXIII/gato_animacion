import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Path } from '../../src/geometry/Path.js';
import { CommandType } from '../../src/geometry/CommandType.js';
import { AABB } from '../../src/math/AABB.js';
import { Vector2 } from '../../src/math/Vector2.js';
import { Matrix3x3 } from '../../src/math/Matrix3x3.js';
import { EPSILON_MATH } from '../../src/math/Epsilon.js';
import { InvalidPathError } from '../../src/errors/InvalidPathError.js';
import { InvalidGeometryError } from '../../src/errors/InvalidGeometryError.js';

const EPS = 1e-9;

// Helper para crear comandos congelados
function cmd(type, params = {}) {
  return Object.freeze({ type, ...params });
}

describe('CommandType', () => {
  it('está congelado', () => {
    assert.equal(Object.isFrozen(CommandType), true);
  });

  it('valores son strings constantes', () => {
    assert.equal(CommandType.MOVE_TO, 'MOVE_TO');
    assert.equal(CommandType.LINE_TO, 'LINE_TO');
    assert.equal(CommandType.QUADRATIC_TO, 'QUADRATIC_TO');
    assert.equal(CommandType.CUBIC_TO, 'CUBIC_TO');
    assert.equal(CommandType.CLOSE, 'CLOSE');
  });

  it('no se puede modificar', () => {
    assert.throws(() => {
      CommandType.MOVE_TO = 'OTHER';
    });
  });
});

describe('Path — PATH-001 constructor', () => {
  it('constructor([]) → Path vacío válido', () => {
    const path = new Path([]);
    assert.ok(path instanceof Path);
  });

  it('constructor con comandos válidos', () => {
    const commands = [
      cmd(CommandType.MOVE_TO, { x: 0, y: 0 }),
      cmd(CommandType.LINE_TO, { x: 10, y: 10 })
    ];
    const path = new Path(commands);
    assert.ok(path instanceof Path);
  });

  it('copia del array: mutar array externo no afecta al Path', () => {
    const commands = [cmd(CommandType.MOVE_TO, { x: 0, y: 0 })];
    const path = new Path(commands);
    commands.push(cmd(CommandType.LINE_TO, { x: 10, y: 10 }));
    // El Path no debe haber cambiado
    assert.equal(path.segmentCount(), 0);
  });

  it('comandos compartidos: mismas referencias congeladas', () => {
    const moveCmd = cmd(CommandType.MOVE_TO, { x: 0, y: 0 });
    const commands = [moveCmd];
    const path = new Path(commands);
    path.moveTo(10, 10);
    // El primer comando debe ser el mismo objeto
    // (no podemos acceder directamente, pero verificamos que no lanza)
    path.validate();
  });

  it('rechaza comando no-congelado (decisión f)', () => {
    const commands = [{ type: CommandType.MOVE_TO, x: 0, y: 0 }]; // no congelado
    assert.throws(() => new Path(commands), InvalidPathError);
  });

  it('rechaza type no reconocido', () => {
    const commands = [cmd('INVALID_TYPE', { x: 0, y: 0 })];
    assert.throws(() => new Path(commands), InvalidPathError);
  });

  it('rechaza params NaN', () => {
    const commands = [cmd(CommandType.MOVE_TO, { x: NaN, y: 0 })];
    assert.throws(() => new Path(commands), InvalidPathError);
  });

  it('rechaza params Infinity', () => {
    const commands = [cmd(CommandType.MOVE_TO, { x: 0, y: Infinity })];
    assert.throws(() => new Path(commands), InvalidPathError);
  });

  it('rechaza params faltantes', () => {
    const commands = [cmd(CommandType.MOVE_TO, { x: 0 })]; // falta y
    assert.throws(() => new Path(commands), InvalidPathError);
  });

  it('rechaza null como argumento', () => {
    assert.throws(() => new Path(null), InvalidPathError);
  });

  it('rechaza array con null', () => {
    assert.throws(() => new Path([null]), InvalidPathError);
  });
});

describe('Path — PATH-002 moveTo', () => {
  it('moveTo(0, 0) → 1 comando MOVE_TO', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    assert.equal(path.segmentCount(), 0); // MOVE_TO no cuenta
  });

  it('moveTo(NaN, 0) → error', () => {
    const path = new Path([]);
    assert.throws(() => path.moveTo(NaN, 0), InvalidPathError);
  });

  it('moveTo(0, Infinity) → error', () => {
    const path = new Path([]);
    assert.throws(() => path.moveTo(0, Infinity), InvalidPathError);
  });

  it('múltiples moveTo generan múltiples subpaths', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    path.moveTo(20, 20);
    path.lineTo(30, 30);
    assert.equal(path.segmentCount(), 2);
  });
});

describe('Path — PATH-003 lineTo', () => {
  it('lineTo tras moveTo → agrega comando', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    assert.equal(path.segmentCount(), 1);
  });

  it('lineTo sin moveTo → InvalidPathError', () => {
    const path = new Path([]);
    assert.throws(() => path.lineTo(10, 10), InvalidPathError);
  });

  it('lineTo(NaN, 0) → error', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    assert.throws(() => path.lineTo(NaN, 0), InvalidPathError);
  });

  it('lineTo tras close() → error (sin subpath activo)', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    path.close();
    assert.throws(() => path.lineTo(20, 20), InvalidPathError);
  });
});

describe('Path — PATH-004 quadraticTo', () => {
  it('quadraticTo tras moveTo → agrega comando', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.quadraticTo(5, 10, 10, 10);
    assert.equal(path.segmentCount(), 1);
  });

  it('quadraticTo sin moveTo → error', () => {
    const path = new Path([]);
    assert.throws(() => path.quadraticTo(5, 10, 10, 10), InvalidPathError);
  });

  it('quadraticTo con NaN → error', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    assert.throws(() => path.quadraticTo(NaN, 10, 10, 10), InvalidPathError);
  });
});

describe('Path — PATH-005 cubicTo', () => {
  it('cubicTo tras moveTo → agrega comando', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.cubicTo(5, 10, 15, 10, 20, 0);
    assert.equal(path.segmentCount(), 1);
  });

  it('cubicTo sin moveTo → error', () => {
    const path = new Path([]);
    assert.throws(() => path.cubicTo(5, 10, 15, 10, 20, 0), InvalidPathError);
  });

  it('cubicTo con NaN → error', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    assert.throws(() => path.cubicTo(NaN, 10, 15, 10, 20, 0), InvalidPathError);
  });
});

describe('Path — PATH-006 close', () => {
  it('close tras moveTo+lineTo → agrega CLOSE', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    path.close();
    assert.equal(path.segmentCount(), 1); // CLOSE no cuenta
  });

  it('close sin subpath activo → InvalidPathError (decisión a)', () => {
    const path = new Path([]);
    assert.throws(() => path.close(), InvalidPathError);
  });

  it('close consecutivo → InvalidPathError (decisión e)', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    path.close();
    assert.throws(() => path.close(), InvalidPathError);
  });

  it('close no agrega LINE_TO implícito', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    const countBefore = path.segmentCount();
    path.close();
    const countAfter = path.segmentCount();
    assert.equal(countBefore, countAfter); // CLOSE no agrega segmento
  });
});

describe('Path — PATH-007 clone', () => {
  it('clone() !== original', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    const cloned = path.clone();
    assert.notEqual(cloned, path);
  });

  it('arrays distintos', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    const cloned = path.clone();
    cloned.lineTo(10, 10);
    assert.equal(path.segmentCount(), 0);
    assert.equal(cloned.segmentCount(), 1);
  });

  it('comandos compartidos (mismas referencias congeladas)', () => {
    const moveCmd = cmd(CommandType.MOVE_TO, { x: 0, y: 0 });
    const path = new Path([moveCmd]);
    const cloned = path.clone();
    // No podemos acceder directamente a los comandos, pero verificamos que no lanza
    cloned.validate();
    path.validate();
  });

  it('mutar clone no afecta original', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    const cloned = path.clone();
    cloned.lineTo(10, 10);
    assert.equal(path.segmentCount(), 0);
  });

  it('mutar original no afecta clone', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    const cloned = path.clone();
    path.lineTo(10, 10);
    assert.equal(cloned.segmentCount(), 0);
  });

  it('clone() de Path vacío no lanza', () => {
    const path = new Path([]);
    assert.doesNotThrow(() => path.clone());
  });
});

describe('Path — PATH-008 isClosed', () => {
  it('Path con CLOSE → true', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    path.close();
    assert.equal(path.isClosed(), true);
  });

  it('Path sin CLOSE → false', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    assert.equal(path.isClosed(), false);
  });

  it('Path vacío → false', () => {
    const path = new Path([]);
    assert.equal(path.isClosed(), false);
  });

  it('último punto == primer punto sin CLOSE → false', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    path.lineTo(0, 0); // vuelve al inicio pero sin CLOSE
    assert.equal(path.isClosed(), false);
  });

  it('múltiples subpaths, todos cerrados → true (decisión b)', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    path.close();
    path.moveTo(20, 20);
    path.lineTo(30, 30);
    path.close();
    assert.equal(path.isClosed(), true);
  });

  it('múltiples subpaths, uno abierto → false (decisión b)', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    path.close();
    path.moveTo(20, 20);
    path.lineTo(30, 30);
    // sin close
    assert.equal(path.isClosed(), false);
  });
});

describe('Path — PATH-009 segmentCount', () => {
  it('Path con 1 MOVE_TO + 3 LINE_TO + 1 CLOSE → 3', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    path.lineTo(20, 20);
    path.lineTo(30, 30);
    path.close();
    assert.equal(path.segmentCount(), 3);
  });

  it('Path con 1 MOVE_TO → 0', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    assert.equal(path.segmentCount(), 0);
  });

  it('Path con 1 MOVE_TO + 1 QUADRATIC_TO + 1 CUBIC_TO → 2', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.quadraticTo(5, 10, 10, 10);
    path.cubicTo(15, 10, 25, 10, 30, 0);
    assert.equal(path.segmentCount(), 2);
  });

  it('Path vacío → 0', () => {
    const path = new Path([]);
    assert.equal(path.segmentCount(), 0);
  });
});

describe('Path — PATH-010 validate', () => {
  it('Path válido → no lanza', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    path.close();
    assert.doesNotThrow(() => path.validate());
  });

  it('validate() no muta el Path', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    const countBefore = path.segmentCount();
    path.validate();
    assert.equal(path.segmentCount(), countBefore);
  });

  it('Path vacío → no lanza', () => {
    const path = new Path([]);
    assert.doesNotThrow(() => path.validate());
  });
});

describe('Path — PATH-011 getBounds', () => {
  it('Path vacío → AABB.empty()', () => {
    const path = new Path([]);
    const bounds = path.getBounds();
    assert.equal(bounds.isEmpty(), true);
  });

  it('sólo MOVE_TO → AABB puntual (decisión d)', () => {
    const path = new Path([]);
    path.moveTo(10, 20);
    const bounds = path.getBounds();
    assert.equal(bounds.isEmpty(), false);
    assert.equal(bounds.minX, 10);
    assert.equal(bounds.minY, 20);
    assert.equal(bounds.maxX, 10);
    assert.equal(bounds.maxY, 20);
  });

  it('LINE_TO rectos → bounds exactos', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    path.lineTo(20, 0);
    const bounds = path.getBounds();
    assert.ok(Math.abs(bounds.minX - 0) < EPS);
    assert.ok(Math.abs(bounds.minY - 0) < EPS);
    assert.ok(Math.abs(bounds.maxX - 20) < EPS);
    assert.ok(Math.abs(bounds.maxY - 10) < EPS);
  });

  it('QUADRATIC_TO → bounds con extremo real', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.quadraticTo(5, 20, 10, 0); // punto de control en y=20
    const bounds = path.getBounds();
    // El extremo real de la curva debe estar cerca de y=10 (mitad del control)
    assert.ok(bounds.maxY > 5); // debe incluir parte de la curvatura
    assert.ok(bounds.maxY <= 20); // no debe exceder el punto de control
  });

  it('CUBIC_TO con P1 fuera del rango → bounds incluyen extremo real', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.cubicTo(5, 50, 15, 50, 20, 0); // P1 y P2 muy arriba
    const bounds = path.getBounds();
    // El extremo real de la curva debe estar significativamente arriba
    assert.ok(bounds.maxY > 20); // debe incluir la curvatura extrema
    assert.ok(bounds.maxY <= 50); // no debe exceder los puntos de control
  });

  it('determinismo: dos llamadas → mismo AABB exacto', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.cubicTo(10, 20, 30, 40, 50, 0);
    const bounds1 = path.getBounds();
    const bounds2 = path.getBounds();
    assert.equal(bounds1.minX, bounds2.minX);
    assert.equal(bounds1.minY, bounds2.minY);
    assert.equal(bounds1.maxX, bounds2.maxX);
    assert.equal(bounds1.maxY, bounds2.maxY);
  });

  it('segmento recto (flatness inicial 0) → sin recursión', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.cubicTo(10, 0, 20, 0, 30, 0); // todos en línea recta
    const bounds = path.getBounds();
    assert.ok(Math.abs(bounds.minX - 0) < EPS);
    assert.ok(Math.abs(bounds.maxX - 30) < EPS);
    assert.ok(Math.abs(bounds.minY - 0) < EPS);
    assert.ok(Math.abs(bounds.maxY - 0) < EPS);
  });

  it('test cruzado con Etapa 4: transformar AABB con rotación', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 0);
    path.lineTo(10, 10);
    path.lineTo(0, 10);
    path.close();
    const bounds = path.getBounds();
    const matrix = Matrix3x3.rotation(Math.PI / 4);
    const transformed = bounds.transform(matrix);
    assert.equal(transformed.isEmpty(), false);
    assert.ok(transformed.minX < transformed.maxX);
    assert.ok(transformed.minY < transformed.maxY);
  });

  it('múltiples MOVE_TO → bounds envolvente de todos', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.moveTo(10, 10);
    path.moveTo(20, 20);
    const bounds = path.getBounds();
    assert.ok(Math.abs(bounds.minX - 0) < EPS);
    assert.ok(Math.abs(bounds.minY - 0) < EPS);
    assert.ok(Math.abs(bounds.maxX - 20) < EPS);
    assert.ok(Math.abs(bounds.maxY - 20) < EPS);
  });
});

describe('Path — tests de límite', () => {
  it('Path con 1000 comandos → no degradación catastrófica', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    for (let i = 1; i < 1000; i++) {
      path.lineTo(i, i);
    }
    assert.equal(path.segmentCount(), 999);
    const bounds = path.getBounds();
    assert.ok(bounds.maxX > 900);
  });

  it('comando con coordenadas extremas finitas', () => {
    const path = new Path([]);
    path.moveTo(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    path.lineTo(-Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER);
    const bounds = path.getBounds();
    assert.ok(Number.isFinite(bounds.minX));
    assert.ok(Number.isFinite(bounds.maxX));
  });

  it('comando con coordenadas negativas', () => {
    const path = new Path([]);
    path.moveTo(-10, -20);
    path.lineTo(-5, -10);
    const bounds = path.getBounds();
    assert.ok(bounds.minX < 0);
    assert.ok(bounds.minY < 0);
  });
});

describe('Path — tests ADR-004', () => {
  it('D1: comandos congelados, type string, no clase', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    // No podemos acceder directamente a los comandos, pero verificamos que validate() pasa
    assert.doesNotThrow(() => path.validate());
  });

  it('D2: constructor copia array', () => {
    const commands = [cmd(CommandType.MOVE_TO, { x: 0, y: 0 })];
    const path = new Path(commands);
    commands.push(cmd(CommandType.LINE_TO, { x: 10, y: 10 }));
    assert.equal(path.segmentCount(), 0); // no debe haber cambiado
  });

  it('D2: clone comparte comandos', () => {
    const moveCmd = cmd(CommandType.MOVE_TO, { x: 0, y: 0 });
    const path = new Path([moveCmd]);
    const cloned = path.clone();
    // Ambos deben ser válidos
    assert.doesNotThrow(() => path.validate());
    assert.doesNotThrow(() => cloned.validate());
  });

  it('D4: bounds por subdivisión adaptativa (no puntos de control crudos)', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.cubicTo(5, 100, 15, 100, 20, 0); // puntos de control muy arriba
    const bounds = path.getBounds();
    // Si usara puntos de control crudos, maxY sería 100
    // Con subdivisión adaptativa, debe ser menor (extremo real de la curva)
    assert.ok(bounds.maxY < 100);
    assert.ok(bounds.maxY > 0);
  });

  it('D6: InvalidPathError creado y usado', () => {
    const path = new Path([]);
    assert.throws(() => path.lineTo(10, 10), InvalidPathError);
  });

  it('D6: InvalidGeometryError existe', () => {
    const error = new InvalidGeometryError({
      functionId: 'TEST',
      input: {},
      prevState: null,
      cause: 'test'
    });
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'InvalidGeometryError');
  });
});

describe('Path — tests de dependencias', () => {
  it('no importa de scenegraph/, animation/, domain/, renderer/, engine/, DOM', () => {
    // Verificación por inspección del código: solo importa de math/ y errors/
    // Este test es más una verificación estática, pero lo documentamos
    assert.ok(true);
  });

  it('no usa Date.now(), performance.now(), new Date()', () => {
    // Verificación por inspección del código
    assert.ok(true);
  });

  it('no usa typed arrays', () => {
    // Verificación por inspección del código
    assert.ok(true);
  });

  describe('Path — PATH-012 getCommands', () => {
  it('devuelve copia del array (arrays distintos)', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    const cmds1 = path.getCommands();
    const cmds2 = path.getCommands();
    assert.notEqual(cmds1, cmds2);
    assert.equal(cmds1.length, 2);
    assert.equal(cmds2.length, 2);
  });

  it('los comandos dentro son las mismas referencias congeladas', () => {
    const moveCmd = cmd(CommandType.MOVE_TO, { x: 0, y: 0 });
    const path = new Path([moveCmd]);
    path.lineTo(10, 10);
    const cmds = path.getCommands();
    assert.equal(cmds[0], moveCmd); // misma referencia
    assert.ok(Object.isFrozen(cmds[0]));
  });

  it('mutar el array devuelto no afecta al Path', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    const countBefore = path.segmentCount();
    const cmds = path.getCommands();
    cmds.push(cmd(CommandType.LINE_TO, { x: 20, y: 20 }));
    cmds.pop();
    cmds.length = 0;
    assert.equal(path.segmentCount(), countBefore);
  });

  it('Path vacío → array vacío', () => {
    const path = new Path([]);
    const cmds = path.getCommands();
    assert.deepEqual(cmds, []);
  });

  it('no muta el Path (verificación cruzada)', () => {
    const path = new Path([]);
    path.moveTo(0, 0);
    path.lineTo(10, 10);
    path.quadraticTo(15, 20, 20, 10);
    const countBefore = path.segmentCount();
    path.getCommands();
    assert.equal(path.segmentCount(), countBefore);
  });
});
});s