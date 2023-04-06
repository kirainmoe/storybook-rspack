import type { LoaderContext } from '@rspack/core';
import TinyPool from 'tinypool';
import path from 'path';

const tinyPool = new TinyPool({
  filename: path.resolve(__dirname, './process.mjs'),
});

async function docLoader(this: LoaderContext, source: string, map: string, data: any) {
  const callback = this.async();

  const result: [string, string] | null = await tinyPool.run({
    source,
    map,
    filename: this.resourcePath,
    data,
  });

  if (result) {
    const [docgen, outputMap] = result;
    callback(null, `${source}\n${docgen}`, outputMap, data);
  } else {
    callback(null, source, map, data);
  }
}

export default docLoader;
