import type { Options } from '@storybook/types';
import type { Configuration } from '@rspack/core';
import type { CompileOptions } from '@storybook/mdx2-csf';

import remarkExternalLinks from 'remark-external-links';
import remarkSlug from 'remark-slug';
import { logger } from '@storybook/node-logger';

export async function createDefaultRspackConfig(
  storybookBaseConfig: Configuration,
  options: Options & {
    mdxPluginOptions?: CompileOptions;
  }
): Promise<Configuration> {
  const { mdxPluginOptions = {} } = options;

  const isProd = storybookBaseConfig.mode !== 'development';

  const mdxLoaderOptions = await options.presets.apply('mdxLoaderOptions', {
    skipCsf: true,
    ...mdxPluginOptions,
    mdxCompileOptions: {
      providerImportSource: '@storybook/addon-docs/mdx-react-shim',
      ...mdxPluginOptions.mdxCompileOptions,
      remarkPlugins: [
        remarkSlug,
        remarkExternalLinks,
        ...(mdxPluginOptions?.mdxCompileOptions?.remarkPlugins ?? []),
      ],
    },
  });

  const mdxVersion = global.FEATURES?.legacyMdx1 ? 'MDX1' : 'MDX2';
  logger.info(`Addon-docs: using ${mdxVersion}`);

  const mdxLoader = global.FEATURES?.legacyMdx1
    ? require.resolve('@storybook/mdx1-csf/loader')
    : require.resolve('@storybook/mdx2-csf/loader');

  return {
    ...storybookBaseConfig,
    module: {
      ...storybookBaseConfig.module,
      rules: [
        ...(storybookBaseConfig.module?.rules || []),
        {
          test: /\.(svg|ico|jpg|jpeg|png|apng|gif|eot|otf|webp|ttf|woff|woff2|cur|ani|pdf)(\?.*)?$/,
          type: 'asset/resource',
          generator: {
            filename: isProd
              ? 'static/media/[name].[contenthash:8][ext]'
              : 'static/media/[path][name][ext]',
          },
        },
        {
          test: /\.mjs?$/,
          type: 'javascript',
          resolve: {
            // For some compatibility
            fullySpecified: false,
          },
        },
        {
          test: /\.(mp4|webm|wav|mp3|m4a|aac|oga)(\?.*)?$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 10000,
            },
          },
          generator: {
            filename: isProd
              ? 'static/media/[name].[contenthash:8][ext]'
              : 'static/media/[path][name][ext]',
          },
        },
        {
          // any imports from './some-file.md?raw' will be imported as raw string
          // see https://webpack.js.org/guides/asset-modules/#replacing-inline-loader-syntax
          // used to support import raw .md files in MDX
          resourceQuery: /raw/,
          type: 'asset/source',
        },
        {
          test: /(stories|story)\.mdx$/,
          use: [
            {
              loader: mdxLoader,
              options: {
                ...mdxLoaderOptions,
                skipCsf: false,
              },
            },
          ],
        },
        {
          test: /\.mdx$/,
          exclude: /(stories|story)\.mdx$/,
          use: [
            {
              loader: mdxLoader,
              options: mdxLoaderOptions,
            },
          ],
        },
      ],
    },
    resolve: {
      ...storybookBaseConfig.resolve,
      fallback: {
        crypto: false,
        assert: false,
        ...storybookBaseConfig.resolve?.fallback,
      },
    },
  };
}
