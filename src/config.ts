import { DMMF } from '@prisma/generator-helper';
import { z } from 'zod';

const configBoolean = z
  .enum(['true', 'false'])
  .transform((arg) => JSON.parse(arg));

const modelActionEnum = z.nativeEnum(DMMF.ModelAction);

export const configSchema = z.object({
  withMiddleware: configBoolean.default('true'),
  withShield: configBoolean.default('true'),
  contextPath: z.string().default('../../../../src/context'),
  trpcOptionsPath: z.string().optional(),
  showModelNameInProcedure: configBoolean.default('true'),
  generateModelActions: z
    .string()
    .default(Object.values(DMMF.ModelAction).join(','))
    .transform((arg) => {
      return arg
        .split(',')
        .map((action) => modelActionEnum.parse(action.trim()));
    })
});

export type Config = z.infer<typeof configSchema>;
