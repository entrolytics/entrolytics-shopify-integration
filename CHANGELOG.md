# Changelog

## Unreleased

### Changed

- The settings screen is built with Polaris web components (Polaris 2, loaded by App Bridge's
  `AppProvider` from Shopify's CDN) instead of Polaris React, which is deprecated and no longer
  maintained. The fields, options, buttons and help panels are the same; the screen follows the
  admin's current design.
- The app now runs on React Router 7 and `@shopify/shopify-app-react-router` 4 instead of Remix 2
  and `@shopify/shopify-app-remix`, which Shopify supports for critical security fixes only. Build
  with `react-router build`; `typecheck` now runs `react-router typegen` first. Embedded auth uses
  Shopify managed installation and token exchange, which the React Router package always does, so
  the `unstable_newEmbeddedAuthStrategy` flag and `isEmbeddedApp` option are gone.
- Every route that calls `authenticate.admin` now exports `headers`, and the `/app` layout exports
  an `ErrorBoundary`, so the reauthorization and redirect headers Shopify sets on thrown responses
  reach the browser instead of being dropped.

### Fixed

- Document responses now carry Shopify's `Content-Security-Policy: frame-ancestors` header, which
  lets only the shop's own admin embed the app, plus the App Bridge and Polaris preload links. The
  app had no `entry.server`, so `addDocumentResponseHeaders` was never called.
- Shops could not authenticate: the session storage writes `refreshToken` and
  `refreshTokenExpires` on every save, the `Session` table had neither column, and every save failed
  with "Unknown argument `refreshToken`". Migration `20261103000000_session_refresh_token` adds both
  as nullable columns; run `prisma migrate deploy` when deploying.
- `src/lib/entrolytics-config.ts`, which the settings route and the config store import, was never
  committed: the `.gitignore` rule `lib/` meant for a build output also matched `src/lib/`, so a fresh
  clone failed to build. The rule now only ignores a top-level `lib/`, and the file and its test are
  in the repository.
- `@prisma/client` 7.10 was paired with the `prisma` 8 release-candidate CLI, which has no
  `generate` command, so the client was never generated: `PrismaClient` did not exist and the app
  could neither typecheck nor start. Both are now `6.19.3`, the newest release that
  `@shopify/shopify-app-session-storage-prisma` 11 (the latest) supports; it requires
  `prisma`/`@prisma/client` `^6.19.0`, and no published version supports Prisma 7 or 8.
