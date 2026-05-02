import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal Server Error',
    },
  });
};
