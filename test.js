const fs = require('fs')
const path = require('path')
const Parser = require('./dist/index')

const parser = new Parser()
const file = fs.readFileSync('./demos/mdn.mhtml', 'utf8')
parser.parse(file)
parser.rewrite(); // converts all internal links to web pages to internal links based on the other mhtml resources
const res = parser.spit(); // gets parsed data as array of {filename, contents}

for (const {filename, content} of res) {
    fs.writeFileSync(path.join('./dist', filename), content)
}
console.log(res.map(item => item.filename))
