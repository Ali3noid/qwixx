import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
  SUPABASE_URL: {},
  SUPABASE_SERVICE_ROLE_KEY: {},
});
