// eslint-disable-next-line import/no-unresolved
const filenamify = require('filenamify/browser');
const bodyDecoder = require('./decoder');
const linkReplacer = require('./link-replacer');

const CR = '\r'.charCodeAt(0);
const LF = '\n'.charCodeAt(0);
module.exports = class Parser {
  constructor(config = {}) {
    this.maxFileSize = config.maxFileSize || 50 * 1000 * 1000;
    this.rewriteFn = config.rewriteFn || ((name) => filenamify(name));
    this.gotString = false;
  }

  parse(file) { // file is contents
    this.gotString = false;
    if (!Buffer.isBuffer(file)) {
      file = Buffer.from(file);
      this.gotString = true;
    }
    const endOfHeaders = Parser.findDoubleCrLf(file);
    const header = file.slice(0, endOfHeaders).toString();
    const separatorMatch = /boundary="(.*)"/g.exec(header);
    if (!separatorMatch) {
      throw new Error('No separator');
    }
    const separator = `--${separatorMatch[1]}`;
    this.parts = Parser.splitByBoundary(file, separator, endOfHeaders + 1, this.maxFileSize)
      .map(Parser.parsePart);
    return this;
  }

  static splitByBoundary(file, separator, fromPosition, maxFileSize) {
    let index;
    const sepLen = separator.length;
    const parts = [];
    while ((index = file.indexOf(separator, fromPosition + 1)) !== -1) {
      if (index - fromPosition > 12) { // push non empty parts added sometimes
        if (index - fromPosition > maxFileSize) {
          fromPosition = index;
          continue; // ignore too big chunks
        }
        const part = file.slice(fromPosition + sepLen, index);
        parts.push(part);
      }
      fromPosition = index;
    }
    return parts;
  }

  static findDoubleCrLf(file) {
    for (let i = 0, len = file.length; i < len; i++) {
      if (file[i] !== CR && file[i] !== LF) {
        continue;
      }
      if (file[i] === CR && file[i + 1] === LF) {
        // \r\n
        if (file[i + 2] === CR && file[i + 3] === LF) {
          return i;
        }
        continue;
      }
      if (file[i] === LF && file[i + 1] === LF) {
        return i;
      }
    }
    return -1;
  }

  rewrite() {
    const replacerMap = {
      'text/html': linkReplacer.html,
      'text/css': linkReplacer.css,
      'image/svg+xml': linkReplacer.svg,
    };
    const getReplacer = (type) => replacerMap[type] || ((body) => body);

    const entries = this.parts
      .filter((part) => part.location)
      .map((part) => [part.location.trim(), part]);
    const partMap = new Map(entries);
    for (const part of this.parts.filter((x) => x.id)) {
      partMap.set(`cid:${part.id.trim()}`, part);
    }
    const rewriteMap = new Map();
    const urlQueue = []; // record recursive rewrite url, void repeated rewrite
    const proxyRewriteMap = new Proxy(rewriteMap, {
      get: (target, property) => {
        if (property === 'get') {
          return (key) => {
            if (urlQueue.includes(key)) return;

            const value = target.get(key);
            if (value !== undefined) return value;

            // console.log('key', key);
            urlQueue.push(key);
            const part = partMap.get(key);
            if (!part) return;
            const replacer = getReplacer(part.type);
            part.body = replacer(part.body, proxyRewriteMap, part.location);
            const url = this.rewriteFn(part.location, part);
            part.rewriteLocation = url;
            target.set(part.location, url);
            if (part.id) target.set(`cid:${part.id}`, url);
            urlQueue.pop();

            return url;
          };
        }
        const value = target[property];
        if (Object.prototype.toString.call(value) === '[object Function]') return value.bind(target);
        return value;
      }
    });

    for (const part of this.parts) {
      proxyRewriteMap.get(part.location);
    }
    return this;
  }

  spit() {
    return this.parts.map((part) => ({
      filename: part.rewriteLocation,
      content: this.gotString ? part.body.toString() : part.body,
      type: part.type,
    }));
  }

  static parsePart(part) {
    const headerEnd = Parser.findDoubleCrLf(part);
    const headerPart = part.slice(0, headerEnd).toString().trim();
    let startBody = headerEnd + 1;
    while ((part[startBody] === CR || part[startBody] === LF)
     && (startBody < headerEnd + 10)) { // remove some initial whitespace
      startBody++;
    }
    const body = part.slice(startBody);
    const headers = new Map(headerPart.split(/\r?\n/g)
      .map((header) => header.split(': '))
      .map(([key, value]) => [key.toLowerCase(), value]));
    return {
      location: headers.get('content-location'),
      id: Parser.parseContentId(headers.get('content-id')),
      type: headers.get('content-type'),
      encoding: (headers.get('content-transfer-encoding') || '').toLowerCase(),
      body: Parser.parseBody(headers.get('content-transfer-encoding'), body),
    };
  }

  static parseContentId(contentId) {
    if (!contentId) {
      return undefined;
    }
    return contentId.substring(1, contentId.length - 1);
  }

  static parseBody(encoding, body) {
    return bodyDecoder(encoding, body);
  }
};
