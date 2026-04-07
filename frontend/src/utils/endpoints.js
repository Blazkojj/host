const getPanelHost = () => {
  if (typeof window === "undefined") {
    return "localhost";
  }

  return window.location.hostname || "localhost";
};

export const getPrimaryBinding = (bindings = []) => bindings[0] || null;

export const getEndpointAddress = (binding) => {
  if (!binding?.hostPort) {
    return null;
  }

  return `${getPanelHost()}:${binding.hostPort}`;
};

export const getEndpointList = (bindings = []) =>
  bindings
    .filter((binding) => binding?.hostPort)
    .map((binding) => ({
      ...binding,
      address: getEndpointAddress(binding)
    }));
