const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

// Monorepo : Metro doit voir la racine pnpm et résoudre les packages workspace.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// zustand : son build ESM contient `import.meta` (middleware devtools),
// fatal à l'hydratation web (Metro émet un script classique). On résout ce
// seul package vers ses fichiers CJS (index.js / middleware.js / *.js) —
// les autres résolutions restent inchangées.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zustand' || moduleName.startsWith('zustand/')) {
    const sub = moduleName === 'zustand' ? 'index' : moduleName.slice('zustand/'.length);
    const filePath = path.resolve(workspaceRoot, 'node_modules/zustand', `${sub}.js`);
    return { type: 'sourceFile', filePath };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
