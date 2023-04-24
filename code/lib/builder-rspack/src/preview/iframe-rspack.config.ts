import path, { dirname, join, resolve } from 'path';

import type { Configuration } from '@rspack/core';
import HtmlPlugin from '@rspack/plugin-html';
import { watch } from 'chokidar';

import fs, { writeFile } from 'fs-extra';

import slash from 'slash';

import type {
  Options,
  CoreConfig,
  DocsOptions,
  PreviewAnnotation,
  StoriesEntry,
} from '@storybook/types';
import { globals } from '@storybook/preview/globals';
import {
  stringifyProcessEnvs,
  handlebars,
  normalizeStories,
  readTemplate,
  loadPreviewOrConfigFile,
} from '@storybook/core-common';
import { dedent } from 'ts-dedent';
import { promise as glob } from 'glob-promise';
import { minimatch } from 'minimatch';
import { toImportFn } from '../to-importFn';
import type { TypescriptOptions } from '../types';

const wrapForPnP = (input: string) => dirname(require.resolve(join(input, 'package.json')));

const storybookPaths: Record<string, string> = {
  global: wrapForPnP('@storybook/global'),
  ...[
    // these packages are not pre-bundled because of react dependencies
    'api',
    'components',
    'global',
    'manager-api',
    'router',
    'theming',
  ].reduce(
    (acc, sbPackage) => ({
      ...acc,
      [`@storybook/${sbPackage}`]: wrapForPnP(`@storybook/${sbPackage}`),
    }),
    {}
  ),
  // deprecated, remove in 8.0
  [`@storybook/api`]: wrapForPnP(`@storybook/manager-api`),
};

const NODE_MODULES_WITHOUT_TEMP_RE = /node_modules\/(?!.*\.rspack-virtual-module\/)[^/]+/;
const STORIES_FILENAME = 'storybook-stories.js';
const VIRTUAL_MODULE_BASE = '.rspack-virtual-module';
const CWD = process.cwd();
const STORIES_PATH = resolve(join(CWD, STORIES_FILENAME));

export async function listStories(matchers: StoriesEntry[], options: Options) {
  return (
    await Promise.all(
      normalizeStories(matchers, {
        configDir: options.configDir,
        workingDir: options.configDir,
      }).map(({ directory, files }) => {
        const pattern = path.join(directory, files);
        const absolutePattern = path.isAbsolute(pattern)
          ? pattern
          : path.join(options.configDir, pattern);

        return glob(slash(absolutePattern), { follow: true });
      })
    )
  ).reduce((carry, stories) => carry.concat(stories), []);
}

/**
 * Storybook scans all stories in the folder and place them in one module.
 * We need to detect new stories ourself, and regenerate new entry for that
 * story.
 *
 * When `require.context` is usable, we can use that instead.
 */
function watchStories(
  options: Options,
  storiesEntry: StoriesEntry[],
  cwd: string,
  writeModule: (p: string, content: string) => void
) {
  const matchers = normalizeStories(storiesEntry, {
    configDir: options.configDir,
    workingDir: options.configDir,
  }).map(({ directory, files }) => {
    const pattern = path.join(directory, files);
    const absolutePattern = path.isAbsolute(pattern)
      ? pattern
      : path.join(options.configDir, pattern);

    return absolutePattern;
  });

  const watcher = watch(cwd, {
    cwd,
    ignored: NODE_MODULES_WITHOUT_TEMP_RE,
    ignoreInitial: true,
  });

  async function regenerate(p: string) {
    if (matchers.some((entry) => minimatch(join(cwd, p), entry))) {
      const stories = await listStories(matchers, options);
      const newStories = await toImportFn(stories);
      writeModule(STORIES_PATH, newStories);
    }
  }

  watcher.on('add', regenerate);
  watcher.on('unlink', regenerate);

  return watcher;
}

async function virtualModule(
  virtualModuleMap: Record<string, string>,
  cwd: string
): Promise<{
  alias: Record<string, string>;
  writeModule(p: string, content: string): void;
}> {
  // TODO: is there a better idea for this temp folder ?
  const tempDir = path.join(cwd, 'node_modules', VIRTUAL_MODULE_BASE);
  fs.ensureDirSync(tempDir);
  const alias: Record<string, string> = {};

  await Promise.all(
    Reflect.ownKeys(virtualModuleMap).map((k) => {
      const virtualPath = k as string;
      const relativePath = path.relative(cwd, virtualPath);
      const realPath = path.join(tempDir, relativePath);
      alias[virtualPath] = realPath;
      return writeFile(realPath, virtualModuleMap[virtualPath]);
    })
  );

  return {
    writeModule(virtualPath: string, content: string) {
      const relativePath = path.relative(cwd, virtualPath);
      const realPath = path.join(tempDir, relativePath);
      fs.writeFileSync(realPath, content);
    },
    alias,
  };
}

export default async (
  options: Options & Record<string, any> & { typescriptOptions: TypescriptOptions }
): Promise<Configuration> => {
  const {
    outputDir = join('.', 'public'),
    packageJson,
    configType,
    presets,
    previewUrl,
    features,
    serverChannelUrl,
  } = options;

  const isProd = configType === 'PRODUCTION';

  const [
    coreOptions,
    frameworkOptions,
    envs,
    logLevel,
    headHtmlSnippet,
    bodyHtmlSnippet,
    template,
    docsOptions,
    entries,
  ] = await Promise.all([
    presets.apply<CoreConfig>('core'),
    presets.apply('frameworkOptions'),
    presets.apply<Record<string, string>>('env'),
    presets.apply('logLevel', undefined),
    presets.apply('previewHead'),
    presets.apply('previewBody'),
    presets.apply<string>('previewMainTemplate'),
    presets.apply<DocsOptions>('docs'),
    presets.apply<string[]>('entries', []),
  ]);

  const storiesMatchers = await options.presets.apply('stories', [], options);

  const stories = await listStories(storiesMatchers, options);

  const previewAnnotations = [
    ...(await presets.apply<PreviewAnnotation[]>('previewAnnotations', [], options)).map(
      (entry) => {
        // If entry is an object, use the absolute import specifier.
        // This is to maintain back-compat with community addons that bundle other addons
        // and package managers that "hide" sub dependencies (e.g. pnpm / yarn pnp)
        // The vite builder uses the bare import specifier.
        if (typeof entry === 'object') {
          return entry.absolute;
        }
        return path.resolve(CWD, slash(entry));
      }
    ),
    loadPreviewOrConfigFile(options),
  ].filter(Boolean);

  const virtualModuleMapping: Record<string, string> = {};
  if (features?.storyStoreV7) {
    virtualModuleMapping[STORIES_PATH] = await toImportFn(stories);
    const configEntryPath = resolve(join(CWD, 'storybook-config-entry.js'));
    virtualModuleMapping[configEntryPath] = handlebars(
      await readTemplate(
        require.resolve('storybook-builder-rspack/templates/virtualModuleModernEntry.js.handlebars')
      ),
      {
        storiesFilename: STORIES_FILENAME,
        previewAnnotations,
      }
      // We need to double escape `\` for webpack. We may have some in windows paths
    ).replace(/\\/g, '\\\\');
    entries.push(configEntryPath);
  } else {
    throw new Error('Rspack only apply to store V7 for now');
  }

  const { alias, writeModule } = await virtualModule(virtualModuleMapping, CWD);

  // TODO: lazyCompilation
  // const lazyCompilationConfig =
  //   builderOptions.lazyCompilation && !isProd
  //     ? {
  //         lazyCompilation: { entries: false },
  //       }
  //     : {};

  if (!template) {
    throw new Error(dedent`
      Storybook's Rspack builder requires a template to be specified.
      Somehow you've ended up with a falsy value for the template option.

      Please file an issue at https://github.com/storybookjs/storybook with a reproduction.
    `);
  }

  if (!isProd) {
    watchStories(options, storiesMatchers, CWD, writeModule);

    entries.push(
      `${require.resolve('webpack-hot-middleware/client')}?reload=true&quiet=false&noInfo=${
        options.quiet
      }`
    );
  }

  return {
    name: 'preview',
    mode: isProd ? 'production' : 'development',
    devtool: 'cheap-module-source-map',
    entry: entries,
    output: {
      path: resolve(CWD, outputDir),
      filename: isProd ? '[name].[contenthash:8].iframe.bundle.js' : '[name].iframe.bundle.js',
      publicPath: '',
    },
    stats: {
      preset: 'none',
    },
    watchOptions: {
      ignored: NODE_MODULES_WITHOUT_TEMP_RE,
    },
    externals: globals,
    builtins: {
      define: {
        ...stringifyProcessEnvs(envs),
        'process.env': JSON.stringify(envs),
        NODE_ENV: JSON.stringify(process.env.NODE_ENV),
      },
    },
    module: {
      rules: [
        {
          test: /\.md$/,
          type: 'asset/source',
        },
        {
          test: /\.m?js$/,
          type: 'javascript/auto',
        },
        {
          test: /\.m?js$/,
          resolve: {
            fullySpecified: false,
          },
        },
      ],
    },
    resolve: {
      extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json', '.cjs'],
      modules: ['node_modules'].concat(envs.NODE_PATH || []),
      mainFields: ['browser', 'module', 'main'].filter(Boolean),
      alias: { ...storybookPaths, ...alias },
      fallback: {
        path: require.resolve('path-browserify'),
        assert: require.resolve('browser-assert'),
        util: require.resolve('util'),
      },
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
      },
      runtimeChunk: true,
      sideEffects: true,
      moduleIds: 'named',
    },
    devServer: {
      hot: true,
    },
    plugins: [
      // ejs templateParameters is not well supported by rspack builtins.html for now
      // so use JS version HTML plugin here instead
      new HtmlPlugin({
        filename: `iframe.html`,
        // FIXME: `none` isn't a known option
        chunksSortMode: 'none' as any,
        alwaysWriteToDisk: true,
        inject: false,
        template,
        templateParameters: {
          version: packageJson.version || '',
          globals: {
            CONFIG_TYPE: configType,
            LOGLEVEL: logLevel,
            FRAMEWORK_OPTIONS: frameworkOptions,
            CHANNEL_OPTIONS: coreOptions.channelOptions,
            FEATURES: features,
            PREVIEW_URL: previewUrl,
            DOCS_OPTIONS: docsOptions,
            SERVER_CHANNEL_URL: serverChannelUrl,
          },
          headHtmlSnippet,
          bodyHtmlSnippet,
        },
        minify: true,
      }),
    ],
  };
};
