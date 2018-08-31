const swagger = require("./index.js"),
	express = require('express'),
	apiJSON = require("./swagger.json"),
	cors = require('cors'),
	expressDomainMiddleware = require('express-domain-middleware'),
	http = require('http'),
	bodyParser = require('body-parser'),
	jwt = require('express-jwt'),
	methodOverride = require('method-override');

const app = express();

app.use(cors());
app.use(expressDomainMiddleware);
app.use(bodyParser.urlencoded({extended: true, parameterLimit: 5000}));
app.use(bodyParser.json({limit: '1mb'}));
app.use(methodOverride());

const server = http.createServer(app);

const router = swagger.build(apiJSON, {
	"/user": {
		"get": (headers, parameters, res) => {
			res.status(200).send({id: 1})
		}
	},
	"/login": {
		"get": (headers, parameters, res) => {
			res.status(200).send({token: 2})
		}
	}
}, jwt({secret: "d88e18b27d16fedd2e97994f34c49943"}));

app.use('/', router)

server.listen(8080, (err) => {
	if (err) {
		return console.error("server", err)
	}
	console.info("listening", 8080);
});