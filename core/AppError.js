/**
 * Error terstruktur dengan kode, agar UI bisa membedakan jenis kegagalan
 * tanpa mencocokkan teks pesan.
 */
export class AppError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return { code: this.code, message: this.message, details: this.details };
  }

  static from(error, code = 'unexpected') {
    if (error instanceof AppError) return error;
    return new AppError(code, error?.message || String(error));
  }
}
