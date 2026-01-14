const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isNumber = (value) => typeof value === 'number' && !Number.isNaN(value);

const validateValue = (value, rule) => {
  if (rule.type === 'string') {
    return typeof value === 'string';
  }
  if (rule.type === 'number') {
    if (isNumber(value)) {
      return true;
    }
    if (rule.allowStringNumber && typeof value === 'string') {
      return value.trim() !== '' && !Number.isNaN(Number(value));
    }
    return false;
  }
  if (rule.type === 'boolean') {
    return typeof value === 'boolean';
  }
  if (rule.type === 'array') {
    if (!Array.isArray(value)) {
      return false;
    }
    if (rule.elementType) {
      return value.every((item) => validateValue(item, { type: rule.elementType }));
    }
    return true;
  }
  if (rule.type === 'object') {
    return isPlainObject(value);
  }
  return false;
};

const validateShape = (target, schema, location) => {
  const errors = [];

  if (!isPlainObject(target)) {
    errors.push({
      field: location,
      message: `${location} 必須是 JSON 物件`,
    });
    return errors;
  }

  Object.entries(schema).forEach(([field, rule]) => {
    const value = target[field];
    if (value === undefined || value === null) {
      if (!rule.optional) {
        errors.push({
          field,
          message: `${field} 是必填欄位`,
        });
      }
      return;
    }

    if (!validateValue(value, rule)) {
      errors.push({
        field,
        message: `${field} 格式不正確`,
      });
    }
  });

  return errors;
};

const sendValidationError = (res, errors) =>
  res.status(400).json({
    error: 'Validation failed',
    details: errors,
  });

export const validateBody = (schema) => (req, res, next) => {
  const errors = validateShape(req.body, schema, 'body');
  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }
  next();
};

export const validateParams = (schema) => (req, res, next) => {
  const errors = validateShape(req.params, schema, 'params');
  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }
  next();
};
