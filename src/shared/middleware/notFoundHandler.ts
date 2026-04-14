import { Request, Response } from 'express';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { message: `Ruta ${req.method} ${req.path} no encontrada` },
  });
}
