/*
  # Revoke anon and authenticated access to the GraphQL endpoint

  ## Problem
  The pg_graphql extension exposes all tables the `anon` role can SELECT via
  the public /graphql/v1 introspection endpoint. Even with @omit table comments,
  the scanner detects that anon can still reach the GraphQL layer.

  ## Fix
  Revoke EXECUTE on the graphql_public.graphql function from both the `anon`
  and `authenticated` roles. This application uses Supabase's REST API
  (PostgREST) exclusively — the GraphQL endpoint is not used anywhere in the
  codebase — so this has zero functional impact.

  Revoking function access is the definitive way to prevent schema introspection
  via /graphql/v1 because PostgREST calls this function on behalf of the caller.
*/

revoke execute on function graphql_public.graphql from anon;
revoke execute on function graphql_public.graphql from authenticated;
