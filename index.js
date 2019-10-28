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

    return {
        load: (id) => {
            let matches = id.match(MODULE_NAME_REGEX);

            if (matches) {
                let name = matches[1];
                let pkgPath = require.resolve(`${name}/package.json`);
                let basePath = dirname(pkgPath);

                let json = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                let cacheKey = `${json.name}@${json.version}`;

                if (!cache[cacheKey]) {
                    cache[cacheKey] = { basePath, json };
                }
            }
        },

        banner: async () => {
            let data = await Promise.all(
                Object.values(cache).map(async ({ basePath, json }) => {
                    let license = await checkLicense(basePath);
                    return Object.values(license).map(lic => ({ pkg: json, lic }));
                })
            );
            data = [].concat.apply([], data);  // flatten array

            if (options.format === 'table') {
                return renderAsTable(data);
            } else {
                return renderAsJsDocs(data);
            }
        }
    }
}
