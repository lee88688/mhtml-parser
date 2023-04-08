const { nodeResolve } = require('@rollup/plugin-node-resolve')
const commonjs = require('@rollup/plugin-commonjs')
const json = require('@rollup/plugin-json')
const inject = require('@rollup/plugin-inject')

module.exports =  {
  input: './src/parser.js',
  output: {
    file: './dist/index.js',
    format: 'cjs',
  },
  plugins: [commonjs(), nodeResolve({ preferBuiltins: false }), json(), inject({ Buffer: ['buffer', 'Buffer'] })],
}