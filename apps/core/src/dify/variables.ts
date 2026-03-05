export const mergeDifyVariables = (
  providerVariables: Record<string, unknown>,
  sessionVariables: Record<string, unknown>,
  runtimeVariables: Record<string, unknown>
): Record<string, unknown> => {
  return {
    ...providerVariables,
    ...sessionVariables,
    ...runtimeVariables
  };
};
