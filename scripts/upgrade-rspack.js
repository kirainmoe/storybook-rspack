const path = require('path');
const fs = require('fs');

const codePath = path.resolve(__dirname, '../code');

const RC_RE = /-rc\.(\d+)/;
['frameworks/react-rspack', 'lib/builder-rspack', 'presets/react-rspack'].forEach((p) => {
  const jsonPath = path.resolve(codePath, p, 'package.json');

  // eslint-disable-next-line import/no-dynamic-require, global-require
  const json = require(jsonPath);

  const { version } = json;

  // version: 7.0.0-rc.18 -> 7.0.0-rc.19
  const [, rc] = version.match(RC_RE);
  const newRc = parseInt(rc, 10) + 1;
  const newVersion = `7.0.0-rc.${newRc}`;

  json.version = newVersion;

  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));
});
