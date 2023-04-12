declare module 'fast-mhtml' {
  interface IParserPart {
    location: string;
    rewriteLocation?: string;
    id?: string;
    type: string;
    encoding: string;
    body: Uint8Array;
  }

  export interface IParserConfig {
    rewriteFn?: (url: string, part: IParserPart) => string;
    maxFileSize?: number
  }
  export interface IFileResult {
    content: Uint8Array | string;
    type: string;
    filename: string;
  }
  export default class Parser {
    constructor(config?: IParserConfig);
    parse(contents: Uint8Array | string): this;
    rewrite(): this;
    spit(): IFileResult[];
  }
  // export class Converter {
  //   static serve(port?: number): void;
  //   static convert(filename: string): Promise<void>;
  // }
}
