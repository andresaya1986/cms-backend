import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '../errors/AppError';

export function validate(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.slice(1).join('.'),
          message: e.message,
        }));
        throw new AppError('Datos de entrada inválidos', 422, errors);
      }
      next(err);
    }
  };
}
