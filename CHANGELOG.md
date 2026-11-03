# Changelog

## Unreleased

### Changed

- The app now runs on React Router 7 and `@shopify/shopify-app-react-router` 4 instead of Remix 2
  and `@shopify/shopify-app-remix`, which Shopify supports for critical security fixes only. Build
  with `react-router build`; `typecheck` now runs `react-router typegen` first. Embedded auth uses
  Shopify managed installation and token exchange, which the React Router package always does, so
  the `unstable_newEmbeddedAuthStrategy` flag and `isEmbeddedApp` option are gone.
- Every route that calls `authenticate.admin` now exports `headers`, and the `/app` layout exports
  an `ErrorBoundary`, so the reauthorization and redirect headers Shopify sets on thrown responses
  reach the browser instead of being dropped.
