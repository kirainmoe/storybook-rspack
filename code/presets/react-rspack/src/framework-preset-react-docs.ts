import { hasDocsOrControls } from '@storybook/docs-tools';

import { logger } from '@storybook/node-logger';

import type { StorybookConfig } from './types';

export const rspack: StorybookConfig['rspack'] = async (rspackConfig, options) => {
  if (!hasDocsOrControls(options)) return rspackConfig;

  const typescriptOptions = await options.presets.apply<StorybookConfig['typescript']>(
    'typescript',
    {} as any
  );

  const { reactDocgen } = typescriptOptions || {};

  if (reactDocgen !== 'react-docgen') {
    if (reactDocgen !== false && reactDocgen !== undefined) {
      logger.warn(
        `Rspack currently only support 'typescript.reactDocgen: react-docgen' for auto docs generation, but you specified ${reactDocgen}`
      );
    }
    return rspackConfig;
  }

  return {
    ...rspackConfig,
    module: {
      ...rspackConfig.module,
      rules: [
        ...(rspackConfig.module?.rules || []),
        {
          test: /\.(tsx?|jsx?)$/,
          exclude: /node_modules/,
          use: {
            loader: require.resolve('./docgen-loader/index.js'),
            options: {
              resolveOptions: rspackConfig.resolve,
            },
          },
        },
      ],
    },
  };
};
