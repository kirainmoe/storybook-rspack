import actualNameHandler from './actualNameHandler';

export default async ({
  source,
  map,
  filename,
  data,
}: {
  source: string;
  map: string;
  data: unknown;
  filename: string;
}) => {
  const { makeFsImporter, builtinResolvers, defaultHandlers, parse } = await import('react-docgen');
  try {
    const results = parse(source, {
      filename,
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

    return [docgen, map];
  } catch (e) {
    return null;
  }
};
