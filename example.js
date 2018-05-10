const swagger = require("./index.js"),
	express = require('express'),
	apiJSON = require("./swagger.json"),
	cors = require('cors'),
	expressDomainMiddleware = require('express-domain-middleware'),
	http = require('http'),
	bodyParser = require('body-parser'),
	methodOverride = require('method-override');

const app = express();

app.use(cors());
app.use(expressDomainMiddleware);
app.use(bodyParser.urlencoded({extended: true, parameterLimit: 5000}));
app.use(bodyParser.json({limit: '1mb'}));
app.use(methodOverride());

const server = http.createServer(app);

process.env.JWT_SECRET = "d88e18b27d16fedd2e97994f34c49943";

const router = swagger.build(apiJSON, {
	"/user": {
		"get": (headers, parameters, cb) => {
			cb(null, {id: 1})
		},
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