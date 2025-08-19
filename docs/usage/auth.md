# Auth usage

Enable auth by setting `"auth"` in your JSON config. Basic values:

- `true` – enables protectedProcedure/roleProcedure with session strategy defaults
- `{ "strategy": "session" | "jwt" | "custom", "rolesField"?: "role", ... }`

When enabled, the generator emits:

- `routers/helpers/auth.ts` with `ensureAuth(ctx)` and `ensureRole(ctx, roles)`
- `routers/helpers/auth-strategy.ts` strategy stubs
- In `routers/helpers/createRouter.ts`, it wires:
  - `authMiddleware` to populate `ctx.user`
  - `publicProcedure = t.procedure.use(authMiddleware)`
  - `protectedProcedure` and `roleProcedure`

## Strategies

### session

Provide a module that exports `getUser(req)` and point to it:

```
{
  "auth": {
    "strategy": "session",
    "session": { "getUserPath": "../../src/auth/getUser" }
  }
}
```

### jwt

By default, the generator emits a simple HS256 `verifyToken` in `auth-strategy.ts` that validates signature, `exp`, and `nbf`. It uses the secret from `JWT_SECRET` (configurable via `auth.jwt.secretEnv`). You can override by pointing to your own modules.

Provide modules for `verifyToken(token, secret)` and/or `getUserFromPayload(payload)` and optionally header/scheme/secret env:

```
{
  "auth": {
    "strategy": "jwt",
    "jwt": {
      "header": "authorization",
      "scheme": "Bearer",
      "secretEnv": "JWT_SECRET",
      "verifyPath": "../../src/auth/verifyToken",
      "getUserFromPayloadPath": "../../src/auth/getUserFromPayload"
    }
  }
}
```

### custom

Provide a module that exports `resolveUser(req)`:

```
{
  "auth": {
    "strategy": "custom",
    "custom": { "resolverPath": "../../src/auth/resolveUser" }
  }
}
```

## Roles

Set the user field used for role checks with `rolesField` (default `role`). Example:

```
{ "auth": { "rolesField": "roles" } }
```

Then in routers:

- `publicProcedure` – no auth required
- `protectedProcedure` – requires `ctx.user`
- `roleProcedure(['admin'])` – requires role match

## Notes

- The generator creates `auth-strategy.ts` with no-op stubs if your paths aren’t provided; you can implement these functions there or point to your own modules via config.
- The context must include the incoming request at `ctx.req` for the session/jwt strategies; adapt your `createContext` accordingly.
