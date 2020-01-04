/*!
 * express-log-mongo
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * Copyright(c) 2018 Randall Simpson
 * MIT Licensed

 * (The MIT License)

 * Copyright (c) 2014 Jonathan Ong <me@jongleberry.com>
 * Copyright (c) 2014-2017 Douglas Christopher Wilson <doug@somethingdoug.com>
 * Copyright (c) 2018 Randall Simpson <chipdawg112@msn.com>

 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * 'Software'), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:

 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

'use strict'

const MongoClient = require('mongodb').MongoClient;

/**
 * Module exports.
 * @public
 */

module.exports = expressMongo;
module.exports.compile = compile;
module.exports.format = format;
module.exports.token = token;
module.exports.retrieveDB = retrieveDB;

/**
 * Module dependencies.
 * @private
 */

var auth = require('basic-auth')
var debug = require('debug')('expressMongo')
var deprecate = require('depd')('expressMongo')
var onFinished = require('on-finished')
var onHeaders = require('on-headers')

/**
 * Create a logger middleware.
 *
 * @public
 * @param {String|Function} format
 * @param {Object} [options]
 * @return {Function} middleware
 */

function expressMongo(format, options) {
    var fmt = format
    var opts = options || {}

    if (opts.url === undefined ||
        opts.db === undefined ||
        opts.collection === undefined) {
        deprecate('expressMongo options must include url, db and collection')
    }

    if (fmt === undefined) {
        fmt = 'default';
    }

    // output on request instead of response
    var immediate = opts.immediate

    // check if log entry should be skipped
    var skip = opts.skip || false

    // format function
    var formatLine = typeof fmt !== 'function'
        ? getFormatFunction(fmt)
        : fmt

    // setup options for retrieve function
    expressMongo['options'] = options;

    // stream
    //var stream = opts.stream || process.stdout

    return function logger(req, res, next) {
        // request data
        req._startAt = undefined
        req._startTime = undefined
        req._remoteAddress = getip(req)

        // response data
        res._startAt = undefined
        res._startTime = undefined

        // record request start
        recordStartTime.call(req)

        function logRequest() {
            if (skip !== false && skip(req, res)) {
                debug('skip request')
                return
            }

            var line = formatLine(expressMongo, req, res)

            if (line == null) {
                debug('skip line')
                return
            }

            debug('log request');
            debug(line);

            insertDB(opts.url, opts.db, opts.collection, [line])
                .then()
                .catch((err) => console.log(err));
        };

        if (immediate) {
            // immediate log
            logRequest()
        } else {
            // record response start
            onHeaders(res, recordStartTime)

            // log when response finished
            onFinished(res, logRequest)
        }

        next()
    }
}

/**
 * Default format.
 */

expressMongo.format('default', ':date :method :url :status :remote-addr :response-time :http-version :remote-user :res[content-length] :referrer :user-agent')

/**
 * Short format.
 */

expressMongo.format('short', ':remote-addr :remote-user :method :url :http-version :status :res[content-length] :response-time')

/**
 * Tiny format.
 */

expressMongo.format('tiny', ':method :url :status :res[content-length] :response-time')

/**
 * request url
 */

expressMongo.token('url', function getUrlToken(req) {
    return req.originalUrl || req.url
})

/**
 * request method
 */

expressMongo.token('method', function getMethodToken(req) {
    return req.method
})

/**
 * response time in milliseconds
 */

expressMongo.token('response-time', function getResponseTimeToken(req, res, digits) {
    if (!req._startAt || !res._startAt) {
        // missing request and/or response start time
        return
    }

    // calculate diff
    var ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
        (res._startAt[1] - req._startAt[1]) * 1e-6

    // return truncated value
    return parseFloat(ms.toFixed(digits === undefined ? 3 : digits));
})

/**
 * current date
 */

expressMongo.token('date', function getDateToken(req, res, format) {
    var date = new Date()

    return date;
})

/**
 * response status code
 */

expressMongo.token('status', function getStatusToken(req, res) {
    return headersSent(res)
        ? res.statusCode
        : undefined
})

/**
 * normalized referrer
 */

expressMongo.token('referrer', function getReferrerToken(req) {
    return req.headers['referer'] || req.headers['referrer']
})

/**
 * remote address
 */

expressMongo.token('remote-addr', getip)

/**
 * remote user
 */

expressMongo.token('remote-user', function getRemoteUserToken(req) {
    // parse basic credentials
    var credentials = auth(req)

    // return username
    return credentials
        ? credentials.name
        : undefined
})

/**
 * HTTP version
 */

expressMongo.token('http-version', function getHttpVersionToken(req) {
    return parseFloat(req.httpVersionMajor + '.' + req.httpVersionMinor);
})

/**
 * UA string
 */

expressMongo.token('user-agent', function getUserAgentToken(req) {
    return req.headers['user-agent']
})

/**
 * request header
 */

expressMongo.token('req', function getRequestToken(req, res, field) {
    // get header
    var header = req.headers[field.toLowerCase()]

    return Array.isArray(header)
        ? header.join(', ')
        : header
})

/**
 * response header
 */

expressMongo.token('res', function getResponseHeader(req, res, field) {
    if (!headersSent(res)) {
        return undefined
    }

    // get header
    var header = res.getHeader(field)

    return Array.isArray(header)
        ? header.join(', ')
        : header
})

/**
 * Compile a format string into a function.
 *
 * @param {string} format
 * @return {function}
 * @public
 */

function compile(format) {
    if (typeof format !== 'string') {
        throw new TypeError('argument format must be a string')
    }

    var fmt = format.replace(/"/g, '\\"')
    var js = '  "use strict"\n  return {' + fmt.replace(/:([-\w]{2,})(?:\[([^\]]+)\])?/g, function (_, name, arg) {
        var tokenArguments = 'req, res'
        var tokenFunction = 'tokens[' + String(JSON.stringify(name)) + ']'

        if (arg !== undefined) {
            tokenArguments += ', ' + String(JSON.stringify(arg))
        }

        return '\n    "' + name + '": ' + tokenFunction + '(' + tokenArguments + '),'
    });

    js = js.substring(0, js.length - 1) + '}';

    // eslint-disable-next-line no-new-func
    return new Function('tokens, req, res', js)
}

/**
 * Define a format with the given name.
 *
 * @param {string} name
 * @param {string|function} fmt
 * @public
 */

function format(name, fmt) {
    expressMongo[name] = fmt
    return this
}

/**
 * Lookup and compile a named format function.
 *
 * @param {string} name
 * @return {function}
 * @public
 */

function getFormatFunction(name) {
    // lookup format
    var fmt = expressMongo[name] || name || expressMongo.default

    // return compiled format
    return typeof fmt !== 'function'
        ? compile(fmt)
        : fmt
}

/**
 * Get request IP address.
 *
 * @private
 * @param {IncomingMessage} req
 * @return {string}
 */

function getip(req) {
    return req.ip ||
        req._remoteAddress ||
        (req.connection && req.connection.remoteAddress) ||
        undefined
}

/**
 * Determine if the response headers have been sent.
 *
 * @param {object} res
 * @returns {boolean}
 * @private
 */

function headersSent(res) {
    return typeof res.headersSent !== 'boolean'
        ? Boolean(res._header)
        : res.headersSent
}

/**
 * Record the start time.
 * @private
 */

function recordStartTime() {
    this._startAt = process.hrtime()
    this._startTime = new Date()
}

/**
 * Define a token function with the given name,
 * and callback fn(req, res).
 *
 * @param {string} name
 * @param {function} fn
 * @public
 */

function token(name, fn) {
    expressMongo[name] = fn
    return this
}

/**
 * function used to insert db array of item
 *
 * @param {string} url
 * @param {string} db
 * @param {string} collection
 * @param {array} items
 * @return {function} Promise
 * @private
 */

function insertDB(url, db, collection, items) {
    return new Promise((resolve, reject) => {
        MongoClient.connect(url, function (err, client) {
            if (err) {
                if (client)
                    client.close();
                reject(err);
            } else {
                const database = client.db(db);
                const coll = database.collection(collection);

                coll.insertMany(items, function (err, result) {
                    client.close();
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            }
        });
    });
};

/**
 * function used to retrieve the db results
 *
 * @param {string} url
 * @param {string} db
 * @param {string} collection
 * @param {object} opts
 * @return {function} Promise
 * @private
 */
function findDB(url, db, collection, opts) {
    return new Promise((resolve, reject) => {
        MongoClient.connect(url, function (err, client) {
            if (err) {
                if (client)
                    client.close();
                reject(err);
            } else {
                const database = client.db(db);
                const coll = database.collection(collection);

                var find = opts.find || {};
                var sort = opts.sort || {};
                var limit = opts.limit || 1000;
                var skip = opts.skip || 0;

                coll.find(find).sort(sort).limit(limit).skip(skip).toArray(function (err, results) {
                    client.close();
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            }
        });
    });
};

/**
 * function that can be used to retrieve the db results
 *
 * @param {object} options
 * @return {function} Promise
 * @public
 */
function retrieveDB(options) {
    var opts = expressMongo['options'];
    return findDB(opts.url, opts.db, opts.collection, options);
};