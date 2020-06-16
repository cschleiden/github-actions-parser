export class ParseError extends Error {
  constructor(message: string, public start: number, public end: number) {
    super(message);
  }
}
