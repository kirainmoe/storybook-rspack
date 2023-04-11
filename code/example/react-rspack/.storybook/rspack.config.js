module.exports = ({ config }) => {
  config.module.rules.push({
    test: /.mjs/,
    resolve: {
      fullySpecified: false,
    },
  });
  return config;
};
