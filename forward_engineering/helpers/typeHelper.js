const getExtensions = require('./extensionsHelper');
const { prepareReferenceName } = require('../utils/utils');
const { commentDeactivatedItemInner } = require('./commentsHelper');

function getType(data, isParentActivated = false) {
	if (!data) {
		return null;
	}

	if (data.allOf) {
		return {
			allOf: data.allOf.map(item => getType(item, isParentActivated))
		};
	}

	if (Array.isArray(data.type)) {
		return getType(Object.assign({}, data, { type: data.type[0] }), isParentActivated);
	}

	if (data.$ref) {
		return commentDeactivatedItemInner(
			{
				$ref: prepareReferenceName(data.$ref),
			},
			data.isActivated,
			isParentActivated
		);
	}
	
	return commentDeactivatedItemInner(getTypeProps(data, isParentActivated), data.isActivated, isParentActivated);
}

function getTypeProps(data, isParentActivated) {
	const { type, properties, items, required, additionalProperties, isActivated } = data;

    const extensions = getExtensions(data.scopesExtensions);

	switch (type) {
		case 'array':
			return {
				type,
				items: getArrayItemsType(items, isActivated && isParentActivated),
				collectionFormat: data.collectionFormat,
				minItems: data.minItems,
				maxItems: data.maxItems,
				uniqueItems: data.uniqueItems,
				discriminator: data.discriminator,
				readOnly: data.readOnly,
				xml: getXml(data.xml),
				example: parseExample(data.sample) || getArrayItemsExample(items),
				...extensions
			};
		case 'object':
			if (!properties && !additionalProperties) {
				return null;
			}
			return {
				type,
				required,
				properties: getObjectProperties(properties, isActivated && isParentActivated),
				minProperties: data.minProperties,
				maxProperties: data.maxProperties,
				additionalProperties: data.additionalProperties,
				discriminator: data.discriminator,
				readOnly: data.readOnly,
				xml: getXml(data.xml),
				example: parseExample(data.sample),
				...extensions
			};
		case 'parameter':
			if (!properties || properties.length === 0) {
				return null;
			}
			return getType(properties[Object.keys(properties)[0]], isActivated && isParentActivated);
		default:
			return getPrimitiveTypeProps(data);
	}
}

function getArrayItemsType(items, isParentActivated) {
	if (Array.isArray(items)) {
		return Object.assign({}, items.length > 0 ? getType(items[0], isParentActivated) : {});
	}
	return Object.assign({}, items ? getType(items, isParentActivated) : {});
}

function getObjectProperties(properties = {}, isParentActivated) {
	return Object.keys(properties).reduce((acc, propName) => {
		acc[propName] = commentDeactivatedItemInner(
			getType(properties[propName], isParentActivated),
			properties[propName].isActivated,
			isParentActivated
		);
		return acc;
	}, {});
}

function getXml(data) {
	if (!data) {
		return undefined;
	}

	return Object.assign({}, {
		name: data.xmlName,
		namespace: data.xmlNamespace,
		prefix: data.xmlPrefix,
		attribute: data.xmlAttribute,
		wrapped: data.xmlWrapped
	}, getExtensions(data.scopesExtensions));
}

function getPrimitiveTypeProps(data) {
	return {
		type: data.type,
		format: data.format || data.mode,
		description: data.description,
		exclusiveMinimum: data.exclusiveMinimum,
		exclusiveMaximum: data.exclusiveMaximum,
		minimum: data.minimum,
		maximum: data.maximum,
		enum: data.enum,
		pattern: data.pattern,
		default: data.default,
		minLength: data.minLength,
		maxLength: data.maxLength,
		multipleOf: data.multipleOf,
		xml: getXml(data.xml),
		example: data.sample,
		...getExtensions(data.scopesExtensions)
	};
}

function parseExample(data) {
	try {
		return JSON.parse(data);
	} catch(err) {
		return data;
	}
}

function getArrayItemsExample(items) {
	const supportedDataTypes = ['object', 'string', 'number', 'integer', 'boolean'];
	if (Array.isArray(items) && items.length > 1) {
		const itemsExample = items.filter(item => item.isActivated !== false).reduce((acc, item) => {
			if (supportedDataTypes.includes(item.type) && item.sample) {
				const example = item.type === 'object' ? parseExample(item.sample) : item.sample;
				return acc.concat(example);
			}
			return acc;
		}, []);
		if (itemsExample.length > 1) {
			return itemsExample;
		}
	}
}

module.exports = {
	getType,
};
