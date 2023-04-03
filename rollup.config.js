const { nodeResolve } = require('@rollup/plugin-node-resolve')
const commonjs = require('@rollup/plugin-commonjs')
const json = require('@rollup/plugin-json')

module.exports =  {
  input: './src/parser.js',
  output: {
    file: './dist/bundle.js',
    format: 'cjs',
  },
  plugins: [nodeResolve(), commonjs(), json()]
}