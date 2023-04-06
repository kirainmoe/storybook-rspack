import { hasDocsOrControls } from '@storybook/docs-tools';

import type { StorybookConfig } from './types';

export const rspack: StorybookConfig['rspack'] = async (rspackConfig, options) => {
  if (!hasDocsOrControls(options)) return rspackConfig;

  const typescriptOptions = await options.presets.apply<StorybookConfig['typescript']>(
    'typescript',
    {} as any
  );

  const { reactDocgen } = typescriptOptions || {};

  if (reactDocgen !== 'react-docgen') {
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
            loader: require.resolve('./docgen-loader'),
            options: {
              resolveOptions: rspackConfig.resolve,
            },
          },
        },
      ],
    },
  };
};
