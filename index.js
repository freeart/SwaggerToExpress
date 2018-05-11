const express = require('express'),
	jwt = require('express-jwt'),
	util = require('util'),
	extend = require('extend'),
	Validator = require('jsonschema').Validator,
	convert = require('./openApi.js');

class Swagger {
	constructor() {

	}

	static validate(input, model, schemas) {
		let v = new Validator();
		if (schemas) {
			Object.keys(schemas).forEach((schemaName) => {
				v.addSchema(schemas[schemaName], "/definitions/" + schemaName);
			})
		}
		let validation = v.validate(input, model);
		if (validation.errors && validation.errors.length) {
			return validation.errors[0].toString();
		}
		return null;
	}

	build(swaggerJson, apiHandlers) {
		const router = express.Router();

		Object.keys(swaggerJson.paths).forEach((routePath) => {
			Object.keys(swaggerJson.paths[routePath]).forEach((routeMethod) => {
				swaggerJson.paths[routePath][routeMethod].handler = apiHandlers[routePath][routeMethod];

				if (["post", "get", "put", "delete"].indexOf(routeMethod) == -1) {
					throw Error("wrong map config");
				}

				let jsonschema = convert(swaggerJson.paths[routePath][routeMethod].parameters);

				const secureArea = jsonschema.properties.headers && jsonschema.properties.headers.properties && jsonschema.properties.headers.properties.Authorization;

				let handler = (req, res) => {
					let headers = req.headers;

					let input = extend({}, req.query || {}, req.body || {}, req.user ? {user: req.user} : {});

					let err = Swagger.validate(req, jsonschema, routeMethod != 'get' && swaggerJson.definitions);
					if (err) {
						let container;
						if (typeof err === 'string' || err instanceof String) {
							container = err;
						} else {
							container = util.inspect(err, {showHidden: false, depth: 5, breakLength: Infinity});
						}
						return res.status(500).send({error: container});
					}

					swaggerJson.paths[routePath][routeMethod].handler(headers, input, res);
				}

				if (secureArea) {
					router[routeMethod](swaggerJson.basePath + routePath.split("?")[0], jwt({secret: process.env.JWT_SECRET}), handler);
				} else {
					router[routeMethod](swaggerJson.basePath + routePath.split("?")[0], handler);
				}
			});
		});

		router.use((err, req, res, next) => {
			if (!err) return next();
			if (err.name === 'UnauthorizedError') {
				res.status(401).send({error: 'Invalid token'});
			} else {
				let container;
				if (typeof err === 'string' || err instanceof String) {
					container = err;
				} else {
					container = util.inspect(err, {showHidden: false, depth: 5, breakLength: Infinity});
				}
				res.status(500).send({error: container});
			}
		});

		return router;
	}
}

module.exports = new Swagger();
