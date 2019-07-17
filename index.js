const express = require('express'),
	EventEmitter = require('events'),
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

		const eventEmitter = new EventEmitter();

		router.on = (event, fn) => { eventEmitter.on(event, fn) };
		router.emit = (event, msg) => { eventEmitter.emit(event, msg) };

		Object.keys(swaggerJson.paths).forEach((routePath) => {
			Object.keys(swaggerJson.paths[routePath]).forEach((routeMethod) => {
				swaggerJson.paths[routePath][routeMethod].handler = apiHandlers[swaggerJson.paths[routePath][routeMethod].operationId];

				if (["post", "get", "put", "delete", "patch"].indexOf(routeMethod) == -1) {
					throw Error("wrong map config");
				}

				let jsonschema = convert(swaggerJson.paths[routePath][routeMethod].parameters);

				const secureArea = jsonschema.properties.headers && jsonschema.properties.headers.properties && (jsonschema.properties.headers.properties.Authorization || jsonschema.properties.headers.properties.authorization);

				let handler = (req, res) => {
					let input = {
						header: Object.assign(req.headers, { authorization: req.user }),
						query: req.query,
						body: req.body,
						path: req.params,
						formData: Object.assign(req.files || {}, req.body)
					};

					const d = require('domain').create();
					d.once('error', (err) => {
						router.emit('error', {
							"name": "API_ERROR",
							"env": input,
							"point": req.url,
							"stack": err.stack,
							"message": err.message
						});
						res.status(400).send({
							"name": "API_ERROR",
							...(!process.env.HIDE_ENV && { "env": input }),
							"point": req.url,
							"stack": err.stack,
							"message": err.message
						})
					});
					d.run(async () => {
						const args = [input, res];
						try {
							for (let parameter of swaggerJson.paths[routePath][routeMethod].parameters) {
								if (parameter.required && parameter.in != "body" && !(parameter.name in input[parameter.in])) {
									throw new Error(`${parameter.name} in ${parameter.in} is required`)
								}
								args.push(parameter.in == "body" ? input[parameter.in] : input[parameter.in][parameter.name])
							}
							const subject = swaggerJson.paths[routePath][routeMethod].handler.apply(swaggerJson.paths[routePath][routeMethod].handler, args)
							if (subject && (typeof subject.then == 'function')) {
								const container = await subject;

								if (container !== false) {
									res.status(200).send(container)
								}
							} else {
								res.status(202).send()
							}
						} catch (e) {
							router.emit('error', {
								"name": "API_ERROR",
								"env": input,
								"point": req.url,
								"stack": e.stack,
								"message": e.message
							});
							res.status(400).send({
								"name": "API_ERROR",
								...(!process.env.HIDE_ENV && { "env": input }),
								"point": req.url,
								"stack": e.stack,
								"message": e.message
							})
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

			router.emit('error', {
				"name": "API_ERROR",
				"env": input,
				"point": req.url,
				"stack": err.stack,
				"message": err.message
			});

			res.status(400).send({
				"name": "API_ERROR",
				...(!process.env.HIDE_ENV && { "env": input }),
				"point": req.url,
				"stack": err.stack,
				"message": err.message
			});
		});

		return router;
	}
}

module.exports = new Swagger();
