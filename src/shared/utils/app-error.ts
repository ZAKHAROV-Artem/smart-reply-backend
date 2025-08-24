export class AppError extends Error {
  public code: string
  public status: number
  public details?: any

  constructor(code: string, message: string, status = 400, details?: any) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
