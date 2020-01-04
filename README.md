# express-log-mongo

> Library to be used as express middleware logging information and storing the data into a mongo database.  The logging information is based off the [Morgan package](https://www.npmjs.com/package/morgan).

## Including express-log-mongo

A pre-requisite for this package to work is to have [MongoDB](https://www.mongodb.com/) already setup and available on the network.

```sh
npm install express-log-mongo --save
```

## Usage

### Import the express-log-mongo module

```js
const logger = require('express-log-mongo');
```

### API

#### constructor

```
logger(format, options)
```

Create a new express-log-mongo logger middleware function using `format` and `options` variables.

##### Arguments

###### format

This variable can be a string of a predefined format (`'default'`, `'short'`, `'tiny'`) or it can be a string that holds the specific tokens to be stored (`:date :method :url :status`).

###### options

This object must consist of a url, db, and collection.  These referer to the connection to mongodb url, the database, and the collection.  An example of the options object is:

```js
{
    url: 'mongodb://localhost:27017',
    db: 'databaseName',
    collection: 'logs'
}
```

###### Example

```js
app.use(logger('tiny', {
    url: 'mongodb://localhost:27017',
    db: 'databaseName',
    collection: 'logs'
}));
```

#### retrieveDB

```
logger.retrieveDB(options)
```

##### Arguments

###### options

This object may consist of find, sort, limit, and skip.  The default values for `limit` is `1000` and `skip` is `0`.  An example of the options object is:

```js
{
    find: {},
    sort: { 'date': -1 },
    limit: 100,
	skip: 100
}
```

###### Example

```js
app.get('/logs', (req, res) => {
    logger.retrieveDB({
        find: {},
        sort: { 'date': -1 }
    }).then((results) => {
        res.json(results);
    }).catch((err) => res.status(500).json(err));
});
```

#### Predefined Formats

There are various pre-defined formats provided:

##### default

```js
:date :method :url :status :remote-addr :response-time :http-version :remote-user :res[content-length] :referrer :user-agent
```

##### short

```js
:remote-addr :remote-user :method :url :http-version :status :res[content-length] :response-time
```

##### tiny

```js
:method :url :status :res[content-length] :response-time
```

#### Tokens

Pre-defined tokens available.

##### :date
The current date and time.

##### :http-version

The HTTP version of the request.

##### :method

The HTTP method of the request.

##### :referrer

The Referrer header of the request. This will use the standard mis-spelled Referer header if exists, otherwise Referrer.

##### :remote-addr

The remote address of the request. This will use req.ip, otherwise the standard req.connection.remoteAddress value (socket address).

##### :remote-user

The user authenticated as part of Basic auth for the request.

##### :req[header]

The given header of the request. If the header is not present, the value will be displayed as "-" in the log.

##### :res[header]

The given header of the response. If the header is not present, the value will be displayed as "-" in the log.

##### :response-time[digits]

The time between the request coming into morgan and when the response headers are written, in milliseconds.

The digits argument is a number that specifies the number of digits to include on the number, defaulting to 3, which provides microsecond precision.

##### :status

The status code of the response.

##### :url

The URL of the request. This will use req.originalUrl if exists, otherwise req.url.

##### :user-agent

The contents of the User-Agent header of the request.

### Examples

#### Basic Example - default Format

```js
const express = require('express');
const logger = require('express-log-mongo');

const app = express();

app.use(logger('default', {
    url: 'mongodb://localhost:27017',
    db: 'databaseName',
    collection: 'logs'
}));

app.get('/', function (req, res) {
  res.send('hello, world!')
})

app.listen(8080);
```

#### Using Specific Logging Tokens

```js
const express = require('express');
const logger = require('express-log-mongo');

const app = express();

app.use(logger(':date :method :url :status :remote-addr :response-time :http-version :remote-user :res[content-length] :referrer :user-agent', {
    url: 'mongodb://localhost:27017',
    db: 'databaseName',
    collection: 'logs'
}));

app.get('/', function (req, res) {
  res.send('hello, world!')
})

app.listen(8080);
```

#### Use Custom Token Format

```js
const express = require('express');
const logger = require('express-log-mongo');
const uuid = require('node-uuid');

logger.token('id', (req) => {
	return req.id;
});

const app = express();

app.use(logger(':id :date :method :url :status :remote-addr :response-time :http-version :remote-user :res[content-length] :referrer :user-agent', {
    url: 'mongodb://localhost:27017',
    db: 'databaseName',
    collection: 'logs'
}));

app.use((req, res, next) => {
	req.id = uuid.v4();
	next();
});

app.get('/', function (req, res) {
  res.send('hello, world!')
})

app.listen(8080);
```

#### Handling log get api calls

```js
const express = require('express');
const logger = require('express-log-mongo');

const app = express();

app.use(logger('default', {
    url: 'mongodb://localhost:27017',
    db: 'databaseName',
    collection: 'logs'
}));

app.get('/', function (req, res) {
  res.send('hello, world!')
})

app.get('/logs', (req, res) => {
    logger.retrieveDB({
        find: {},
        sort: { 'date': -1 }
    }).then((results) => {
        res.json(results);
    }).catch((err) => res.status(500).json(err));
});

app.listen(8080);
```

## Contributors

[Randall Simpson](https://www.linkedin.com/in/randall-simpson-356a9111b/)

## License

The MIT License (MIT) 

Copyright (c) 2014 Jonathan Ong
Copyright (c) 2014-2017 Douglas Christopher Wilson
Copyright (c) 2018 Randall Simpson

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.