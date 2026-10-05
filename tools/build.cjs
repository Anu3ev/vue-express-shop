const { copyFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const vendor = path.join(root, 'public', 'vendor');
mkdirSync(vendor, { recursive: true });
copyFileSync(require.resolve('vue/dist/vue.global.prod.js'), path.join(vendor, 'vue.global.prod.js'));
copyFileSync(path.join(path.dirname(require.resolve('vue/package.json')), 'LICENSE'), path.join(vendor, 'vue.LICENSE'));
console.log('Built local Vue browser assets in public/vendor');
