# rollup-plugin-node-license

When you're bundling your app, you should be including license information inside those bundles.
This module assumes you are using NPM modules.
If it detects a node_module was loaded at any point during bundling, it will check its package information and will confirm the license using [License Checker](https://github.com/davglass/license-checker/).
License comments are then appended to the generated bundle.

## How to use

Load the plugin into your Rollup configuration.

```
let license = require('rollup-plugin-node-license');

rollup({
    ...
    plugins: [
        license({
            // Format of the injected license comment(s).
            // Options: "jsdoc" (default), or "table".
            format: 'jsdoc'
        })
    ]
});
```

With ```rollup-plugin-terser```, the following step is not needed. If you're using ```rollup-plugin-uglify```, you should apply the following rule so that the licenses are not removed:

```
uglify({
    output: {
        comments: (node, comment) => {
            if (comment.type === 'comment2') {
                return /^\!/i.test(comment.value);
            }
        }
    }
});
```

After a build, you'll see the license comments at the top of the bundle.
