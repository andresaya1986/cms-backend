import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Error inesperado — no revelar detalles al cliente
  logger.error({ err, req: { method: req.method, url: req.url } }, 'Unexpected error');

  res.status(500).json({
    success: false,
    error: { message: 'Error interno del servidor' },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { message: `Ruta ${req.method} ${req.path} no encontrada` },
  });
}
