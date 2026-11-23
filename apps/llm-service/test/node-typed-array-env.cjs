const { createRequire } = require('node:module');
const path = require('node:path');

const jestMainDir = path.dirname(require.resolve('jest'));
const jestRequire = createRequire(path.join(jestMainDir, 'package.json'));
const jestConfigDir = path.dirname(jestRequire.resolve('jest-config'));
const jestConfigRequire = createRequire(path.join(jestConfigDir, 'package.json'));
const NodeEnvironment = jestConfigRequire('jest-environment-node').default;

/**
 * Aligns TypedArray constructors in Jest's VM context with the host Node.js realm
 * so native C++ addons (e.g. `onnxruntime-node`) pass `instanceof` checks.
 */
class TypedArrayNodeEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    this.global.ArrayBuffer = ArrayBuffer;
    this.global.Float32Array = Float32Array;
    this.global.Float64Array = Float64Array;
    this.global.Int8Array = Int8Array;
    this.global.Int16Array = Int16Array;
    this.global.Int32Array = Int32Array;
    this.global.Uint8Array = Uint8Array;
    this.global.Uint16Array = Uint16Array;
    this.global.Uint32Array = Uint32Array;
    this.global.BigInt64Array = BigInt64Array;
    this.global.BigUint64Array = BigUint64Array;
  }
}

module.exports = TypedArrayNodeEnvironment;
