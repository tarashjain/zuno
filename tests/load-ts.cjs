const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Exercise the actual server modules without connecting to a database or Next request context.
module.exports = function loadTs(relativePath, mocks = {}, env = { NEXTAUTH_SECRET: 'test-only-room-secret' }) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const context = {
    exports: {}, Buffer, crypto: require('node:crypto').webcrypto,
    process: { env },
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name.startsWith('@/') || name.startsWith('next')) throw new Error(`Missing test dependency: ${name}`)
      return require(name)
    },
  }
  vm.runInNewContext(source, context, { filename })
  return context.exports
}
