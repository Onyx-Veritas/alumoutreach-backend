export class ApiResponseDto<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: Record<string, any>;
  timestamp: string;

  static success<T>(data: T, meta?: Record<string, any>): ApiResponseDto<T> {
    const response = new ApiResponseDto<T>();
    response.success = true;
    response.data = data;
    response.meta = meta;
    response.timestamp = new Date().toISOString();
    return response;
  }

  static error(code: string, message: string, details?: any): ApiResponseDto {
    const response = new ApiResponseDto();
    response.success = false;
    response.error = { code, message, details };
    response.timestamp = new Date().toISOString();
    return response;
  }
}
