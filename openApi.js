module.exports = convert;

function convert(parameters) {
	var parametersSchema = {
		"type": "object",
		"properties": {}
	};
	var bodySchema = getBodySchema(parameters);
	var formDataSchema = getSchema(parameters, 'formData');
	var headerSchema = getSchema(parameters, 'header');
	var pathSchema = getSchema(parameters, 'path');
	var querySchema = getSchema(parameters, 'query');

	if (bodySchema) {
		parametersSchema.properties.body = bodySchema;
	}

	if (formDataSchema) {
		parametersSchema.properties.formData = formDataSchema;
	}

	if (headerSchema) {
		parametersSchema.properties.headers = headerSchema;
	}

	if (pathSchema) {
		parametersSchema.properties.path = pathSchema;
	}

	if (querySchema) {
		parametersSchema.properties.query = querySchema;
	}

	return parametersSchema;
}

var VALIDATION_KEYWORDS = [
	'additionalItems',
	'default',
	'description',
	'enum',
	'exclusiveMaximum',
	'exclusiveMinimum',
	'format',
	'items',
	'maxItems',
	'maxLength',
	'maximum',
	'minItems',
	'minLength',
	'minimum',
	'multipleOf',
	'pattern',
	'title',
	'type',
	'uniqueItems'
];

function copyValidationKeywords(src, dst) {
	if (src && dst) {
		for (var i = 0, keys = Object.keys(src), len = keys.length; i < len; i++) {
			var keyword = keys[i];

			if (VALIDATION_KEYWORDS.indexOf(keyword) > -1) {
				dst[keyword] = src[keyword];
			}
		}
	}
}

function fixSchema(haystack) {
	if (typeof haystack !== "object") return;

	for (let key in haystack) {

		fixSchema('$ref', haystack[key]);

		if (key == '$ref') {
			haystack[key] = haystack[key].replace('#', '');
		}
	}
}

function getBodySchema(parameters) {
	var bodySchema = parameters.filter(function (param) {
		return param.in === 'body' && param.schema;
	})[0];

	if (bodySchema) {
		fixSchema(bodySchema.schema);
		bodySchema = bodySchema.schema;
	}

	return bodySchema;
}

function getSchema(parameters, type) {
	var params = parameters.filter(byIn(type));
	var schema;

	if (params.length) {
		schema = {properties: {}};

		params.forEach(function (param) {
			var paramSchema = {};

			schema.properties[param.name] = paramSchema;

			copyValidationKeywords(param, paramSchema);
		});

		schema.required = getRequiredParams(params);
	}

	return schema;
}

function getRequiredParams(parameters) {
	return parameters.filter(byRequired).map(toName);
}

function byIn(str) {
	return function (param) {
		return param.in === str;
	};
}

function byRequired(param) {
	return !!param.required;
}

function toName(param) {
	return param.name;
}