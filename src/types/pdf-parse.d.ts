declare module "pdf-parse" {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: {
      Title?: string;
      Author?: string;
      Creator?: string;
      Producer?: string;
      CreationDate?: string;
      ModDate?: string;
      [key: string]: unknown;
    };
    metadata: unknown;
    text: string;
    version: string;
  }

  interface PDFOptions {
    pagerender?: (pageData: unknown) => Promise<string>;
    max?: number;
    version?: string;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: PDFOptions
  ): Promise<PDFData>;

  export = pdfParse;
}