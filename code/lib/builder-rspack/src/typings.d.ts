declare module 'lazy-universal-dotenv';
declare module '@storybook/theming/paths';

declare var FEATURES:
  | {
      storyStoreV7?: boolean;
      breakingChangesV7?: boolean;
      argTypeTargetsV7?: boolean;
      legacyMdx1?: boolean;
    }
  | undefined;
