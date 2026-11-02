// The server chooses the mode. Client flags and build type cannot enable simulated settlement.
export function stakeholderTesting(env) {
  return env.STAKEHOLDER_TESTING === 'true';
}
export const TEST_PROVIDER = 'stakeholder_test';
