import { ZodError } from 'zod';
import type { Context } from './context';

export default {
  errorFormatter({ shape, error, ctx }: { shape: any; error: any; ctx?: Context }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        requestId: ctx?.requestId,
        zodError:
          error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
};
