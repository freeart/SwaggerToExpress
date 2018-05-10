const express = require('express'),
	jwt = require('express-jwt'),
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
					let input = req.body;
					input.__validate = (input) => {
						return Swagger.validate({
							body: input,
							headers: headers
						}, jsonschema, swaggerJson.definitions);
					};

					swaggerJson.paths[routePath][routeMethod].handler(headers, input, (error, result) => {
						if (error) {
							return res.status(500).send({error});
						}
						res.status(200).send({result});
					});
				}

				if (secureArea) {
					router[routeMethod](swaggerJson.basePath + routePath.split("?")[0], jwt({secret: process.env.JWT_SECRET}), handler);
				} else {
					router[routeMethod](swaggerJson.basePath + routePath.split("?")[0], handler);
				}
			});
		});

		return router;
	}
}

module.exports = new Swagger();
