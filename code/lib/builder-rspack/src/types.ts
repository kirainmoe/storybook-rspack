import type { Configuration, RspackOptions } from '@rspack/core';

import type { Options, StorybookConfig as StorybookConfigBase } from '@storybook/types';

import type ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

type TypeScriptOptionsBase = Required<StorybookConfig>['typescript'];

/**
 * Options for TypeScript usage within Storybook.
 */
export interface TypescriptOptions extends TypeScriptOptionsBase {
  /**
   * Configures `fork-ts-checker-webpack-plugin`
   */
  checkOptions?: ConstructorParameters<typeof ForkTsCheckerWebpackPlugin>[0];
}

export interface StorybookConfigRspack extends StorybookConfig {
  /**
   * Modify or return a custom Rspack config after the Storybook's default configuration
   * has run (mostly used by addons).
   */
  rspack?: (config: Configuration, options: Options) => Configuration | Promise<Configuration>;

  /**
   * Modify or return a custom Rspack config after every addon has run.
   */
  rspackFinal?: (config: Configuration, options: Options) => Configuration | Promise<Configuration>;
}

export type BuilderOptions = {
  lazyCompilation?: boolean;
};

export type RulesConfig = any;

export type ModuleConfig = {
  rules?: RulesConfig[];
};

export type RspackConfiguration = RspackOptions;

export type ResolveConfig = {
  extensions?: string[];
  mainFields?: string[] | undefined;
  alias?: any;
};

export type StorybookConfig<TRspackConfiguration = RspackOptions> = StorybookConfigBase & {
  /**
   * Modify or return a custom Rspack config after the Storybook's default configuration
   * has run (mostly used by addons).
   */
  rspack?: (
    config: TRspackConfiguration,
    options: Options
  ) => TRspackConfiguration | Promise<TRspackConfiguration>;

  /**
   * Modify or return a custom Rspack config after every addon has run.
   */
  rspackFinal?: (
    config: TRspackConfiguration,
    options: Options
  ) => TRspackConfiguration | Promise<TRspackConfiguration>;
};

export type { Options, RspackOptions };
