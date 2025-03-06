import { argv, env } from "node:process";


const availableParams = new Set([
    'input',
    'output',
    'postfix',
    'chapterSeparator',
    'stats',
    'url',
    'apiKey',
    'timeout',
    'prompt',
]);

/**
 * @returns {{
 *     input: String,
 *     [output]: String,
 *     [postfix]: String,
 *     [chapterSeparator]: RegExp,
 *     [stats]: Boolean,
 *     [url]: String,
 *     [apiKey]: String,
 *     [timeout]: Number,
 *     [prompt]: String,
 * }} params
 */
export function getCommandLineParams() {
    const envs = getCommandLineParamsFromEnvironment()
    const args = getCommandLineParamsFromArguments()

    return fixTypes({ ...envs, ...args })
}

/**
 * Get params from env. It needs to call from npm. Example: npm start ./input.txt --output=./output.txt
 * @returns {Object}
 */
function getCommandLineParamsFromEnvironment() {
    return Object.entries(env).reduce((acc, [key, value]) => {
        if (key.startsWith('npm_config_')) {
            const formattedKey = convertToCamelCase(key.replace('npm_config_', ''));
            if (availableParams.has(formattedKey)) {
                acc[formattedKey] = value
            }
        }
        return acc;
    }, {})
}

/**
 * Get params from argv. It needs to call from node. Example: node ./src/main.js ./input.txt --output=./output.txt
 * @returns {Object}
 */
function getCommandLineParamsFromArguments() {
    return argv.slice(2).reduce((obj, arg) => { // first arg is path to node.js, second arg is path to executing file
        const [key, value] = arg.split('=');

        if (key.startsWith('--')) {
            const formattedKey = convertToCamelCase(key.slice(2));
            if (availableParams.has(formattedKey)) {
                obj[formattedKey] = value ?? true;
            }
        } else {
            obj.input = key;
        }

        return obj;
    }, {})
}

/**
 * @param {String} str string in snake_case
 * @returns {String}
 */
function convertToCamelCase(str) {
    return str.replace(/_[a-z]/g, str => str[1].toUpperCase());
}

/**
 * @param {Object} obj
 * @returns {Object}
 */
function fixTypes(obj) {
    for (const key in obj) {
        if (obj[key] === 'null') {
            obj[key] = null;
        }
        else if(obj[key] === 'true') {
            obj[key] = true;
        }
        else if(obj[key] === 'false') {
            obj[key] = false;
        }
        else if (obj[key].at(0) === '/' && obj[key].at(-1) === '/') {
            obj[key] = new RegExp(obj[key].slice(1, -1));
        }
        else if(!isNaN(obj[key])) { // isNaN() tries to convert the string into a number. If the conversion is not successful, it returns true
            obj[key] = Number(obj[key]);
        }
    }
    return obj;
}
