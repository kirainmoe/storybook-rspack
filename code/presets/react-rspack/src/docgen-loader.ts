import type { LoaderContext } from '@rspack/core';
import actualNameHandler from './actualNameHandler';

async function docLoader(this: LoaderContext, source: string, map: string, data: any) {
  const callback = this.async();
  const { makeFsImporter, builtinResolvers, defaultHandlers, parse } = await import('react-docgen');
  try {
    const results = parse(source, {
      filename: this.resourcePath,
      resolver: new builtinResolvers.FindAllDefinitionsResolver(),
      importer: makeFsImporter(),
      handlers: [...defaultHandlers, actualNameHandler],
    });

    const docgen = results
      .map((result) => {
        // @ts-expect-error we know actualName is added by actualNameHandler, so it exist
        const { actualName, ...docgenInfo } = result;
        if (actualName) {
          return `${actualName}.__docgenInfo=${JSON.stringify(docgenInfo)}`;
        }
        return '';
      })
      .join(';');

    callback(null, `${source}\n${docgen}`, map, data);
  } catch (e) {
    callback(null, source, map, data);
  }
}

export default docLoader;
