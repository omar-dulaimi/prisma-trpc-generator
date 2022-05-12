import { z } from 'zod'

const configBoolean = z.enum(['true', 'false']).transform((arg) => JSON.parse(arg))

export const configSchema = z.object({
	withMiddleware: configBoolean.default('true').or(z.literal('default')),
})

export type Config = z.infer<typeof configSchema>

