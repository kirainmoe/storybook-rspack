import type {
  ReactOptions,
  StorybookConfig as StorybookConfigBase,
} from '@fy-dev/preset-react-rspack';
import type {
  StorybookConfigRspack,
  BuilderOptions,
  TypescriptOptions as TypescriptOptionsBuilder,
} from '@fy-dev/builder-rspack';

type FrameworkName = '@storybook/react-rspack';
type BuilderName = '@fy-dev/builder-rspack';

export type FrameworkOptions = ReactOptions & {
  builder?: BuilderOptions;
};

type StorybookConfigFramework = {
  framework:
    | FrameworkName
    | {
        name: FrameworkName;
        options: FrameworkOptions;
      };
  core?: StorybookConfigBase['core'] & {
    builder?:
      | BuilderName
      | {
          name: BuilderName;
          options: BuilderOptions;
        };
  };
  typescript?: Partial<TypescriptOptionsBuilder> & StorybookConfigBase['typescript'];
};

/**
 * The interface for Storybook configuration in `main.ts` files.
 */
export type StorybookConfig = Omit<
  StorybookConfigBase,
  keyof StorybookConfigRspack | keyof StorybookConfigFramework
> &
  StorybookConfigRspack &
  StorybookConfigFramework;
