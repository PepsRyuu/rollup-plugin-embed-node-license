let fs = require('fs');
let licenseChecker = require('license-checker');
let { dirname } = require('path');
let renderTable = require('markdown-table');
let MODULE_NAME_REGEX = /(?:node_modules(?:\\|\/)((?:@[^\\|\/]+(?:\\|\/)[^\\|\/]+)|[^\\|\/]+))/;

function checkLicense (path) {
    return new Promise(resolve => {
        licenseChecker.init({
            start: path
        }, (err, json) => {
            resolve(json);
        })
    });
}

function ellipsis (text, limit) {
    if (!text || text.length <= limit) {
        return text;
    }
    return text.slice(0, limit - 3) + '...';
}

function renderAsJsDocs (data) {
    return data.map(({ pkg, lic }) => [
        '/*!',
        ` * @package ${pkg.name}`,
        ` * @version ${pkg.version}`,
        ` * @license ${lic.licenses}`,
        ` * @author ${lic.publisher}`,
        ` * @url ${lic.repository || lic.email}`,
        ' */'
    ].join('\n')).join('');
}

function renderAsTable (data) {
    let rows = data.map(({ pkg, lic }) => {
        let source = ellipsis(lic.repository || lic.email, 65);
        return [pkg.name, pkg.version, lic.licenses, ellipsis(lic.publisher, 30), source];
    });
    rows.sort(([a], [b]) => a.localeCompare(b));
    rows.unshift(['Name', 'Version', 'License(s)', 'Publisher', 'Source']);

    return [
        '/*!',
        ' * Bundled npm packages',
        ' *',
        renderTable(rows, { start: ' * | ' }),
        ' */'
    ].join('\n');
}

module.exports = function (options = {}) {
    let cache = {};

    function loadIntoCache(name) {
        try {
            let pathWithPkgJson = name;
            let parts = name.split('/');
            
            // Support situation where you might import a file inside a package
            while (parts.length > 0) {
                try {
                    require.resolve(`${parts.join('/')}/package.json`);
                    pathWithPkgJson = parts.join('/');
                    break;
                } catch {
                    parts.pop();
                }
            }

            let pkgPath = require.resolve(`${pathWithPkgJson}/package.json`);
            let basePath = dirname(pkgPath);
            let json = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            let cacheKey = `${json.name}@${json.version}`;
        
            if (!cache[cacheKey]) {
                cache[cacheKey] = { name, basePath, json };
            }
        } catch (e) {
            this.warn('Failed to parse package information for "' + name + '"');
        }
    }

    return {
        name: 'node-license',

        resolveId: {
            order: 'pre',
            handler: function (id) {
                if (!id.startsWith('.')) {
                    loadIntoCache.call(this, id);
                }
            }
        },

        load: function (id) {
            let matches = id.match(MODULE_NAME_REGEX);

            if (matches) {
                let name = matches[1];
                if (!name.startsWith('.')) {
                    loadIntoCache.call(this, name);
                }
            }
        },

        banner: async function () {
            let exclude = options.exclude || [];

            let data = await Promise.all(
                Object.values(cache).map(async ({ basePath, json }) => {
                    let license = await checkLicense(basePath);
                    return Object.values(license).map(lic => ({ pkg: json, lic }));
                })
            );
            data = [].concat.apply([], data);  // flatten array

            data = data.filter(d => !exclude.includes(d.pkg.name));
            
            if (options.format === 'table') {
                return renderAsTable(data);
            } else {
                return renderAsJsDocs(data);
            }
        }
    }
}