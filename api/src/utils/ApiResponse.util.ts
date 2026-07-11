export class ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;

  constructor(success: boolean, message: string, data: T) {
    this.success = success;
    this.message = message;
    this.data = data;
  }

  static ok<T>(message: string, data: T): ApiResponse<T> {
    return new ApiResponse(true, message, data);
  }

  static error<T = null>(message: string, data: T = null as T): ApiResponse<T> {
    return new ApiResponse(false, message, data);
  }
}
