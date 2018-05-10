```sh
npm install swaggertoexpress
```

```javascript
const swagger = require("swaggertoexpress");
const express = require('express');
const apiJSON = require("./swagger.json");

const app = express();

const router = swagger.build(apiJSON, {
	"/user": {
		"get": (headers, parameters, cb) => {
			cb(null, {id: 1})
		}
	},
	"/login": {
		"get": (headers, parameters, cb) => {
			cb(null, {token: 2})
		}
	}
});

app.use('/', router)

server.listen(8080, (err) => {
	if (err) {
		return console.error("server", err)
	}
	console.info("listening", 8080);
});

```