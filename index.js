const express = require('express'),
	Validator = require('jsonschema').Validator,
	convert = require('./openApi.js');

class Swagger {
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

	build(swaggerJson, apiHandlers, protect) {
		const router = express.Router();

		Object.keys(swaggerJson.paths).forEach((routePath) => {
			Object.keys(swaggerJson.paths[routePath]).forEach((routeMethod) => {
				swaggerJson.paths[routePath][routeMethod].handler = apiHandlers[routePath][routeMethod];

				if (["post", "get", "put", "delete", "patch"].indexOf(routeMethod) == -1) {
					throw Error("wrong map config");
				}

				let jsonschema = convert(swaggerJson.paths[routePath][routeMethod].parameters);

				let secureArea = jsonschema.properties.headers && jsonschema.properties.headers.properties && (jsonschema.properties.headers.properties.Authorization || jsonschema.properties.headers.properties.authorization);
				secureArea = secureArea || (jsonschema.properties.query && jsonschema.properties.query.properties && (jsonschema.properties.query.properties.Authorization || jsonschema.properties.query.properties.authorization));
				secureArea = secureArea || (jsonschema.properties.path && jsonschema.properties.path.properties && (jsonschema.properties.path.properties.Authorization || jsonschema.properties.path.properties.authorization));

				let handler = (req, res) => {
					let input = {
						headers: req.headers,
						query: req.query,
						body: req.body,
						params: req.params,
						user: req.user,
						files: req.files
					};

					const d = require('domain').create();
					d.once('error', (err) => {
						res.status(400).send({
							"name": "API_ERROR",
							"env": input,
							"point": req.url,
							"stack": err.stack,
							"message": err.message
						})
					});
					d.run(async () => {
						const subject = swaggerJson.paths[routePath][routeMethod].handler(input, res);
						if (typeof subject.then == 'function') {
							let container, status;
							try {
								container = await subject;
								status = 200;
							} catch (e) {
								container = {
									"name": "API_ERROR",
									"env": input,
									"point": req.url,
									"stack": e.stack,
									"message": e.message
								}
								status = 400;
							}
							if (container !== false) {
								res.status(status).send(container)
							}
						}
					})
				}

				let optPath = routePath.split("?")[0];
				const regex = /[^\/]+/gm;
				let m;

				while ((m = regex.exec(optPath)) !== null) {
					// This is necessary to avoid infinite loops with zero-width matches
					if (m.index === regex.lastIndex) {
						regex.lastIndex++;
					}

					// The result can be accessed through the `m`-variable.
					m.forEach((match, groupIndex) => {
						if (match[0] == "{" && match[match.length - 1] == "}") {
							optPath = optPath.replace(match, ":" + match.slice(1, -1))
						}
					});
				}

				if (secureArea && protect) {
					router[routeMethod](swaggerJson.basePath + optPath, protect, handler);
				} else {
					router[routeMethod](swaggerJson.basePath + optPath, handler);
				}
			});
		});

		router.use((err, req, res, next) => {
			if (!err) return next();
			let input = {
				headers: req.headers,
				query: req.query,
				body: req.body,
				params: req.params,
				user: req.user
			};

			res.status(400).send({
				"name": "API_ERROR",
				"env": input,
				"point": req.url,
				"stack": err.stack,
				"message": err.message
			});
		});

		return router;
	}
}

module.exports = new Swagger();
