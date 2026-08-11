const providers = {
  wannads: {
    name: "Wannads",
    type: "offerwall",
    enabled: true
  },

  kiwiwall: {
    name: "Kiwiwall",
    type: "offerwall",
    enabled: true
  },

  cpx: {
    name: "CPX Research",
    type: "survey",
    appId: process.env.CPX_APP_ID || "34754",
    enabled: true
  },

  monlix: {
    name: "Monlix",
    type: "offerwall",
    enabled: true
  },

  cpagrip: {
    name: "CPA Grip",
    type: "offerwall",
    enabled: true
  },

  adgem: {
    name: "AdGem",
    type: "offerwall",
    enabled: true
  }
};

function getEnabledProviders() {
  return Object.values(providers).filter(
    (provider) => provider.enabled
  );
}

function getProvider(providerId) {
  return providers[providerId] || null;
}

module.exports = {
  providers,
  getEnabledProviders,
  getProvider
};
