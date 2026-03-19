function evaluateCondition(condition, data) {
  if (!condition || typeof condition !== 'string') return false;

  // DEFAULT is a special keyword that always evaluates to true
  if (condition.trim().toUpperCase() === 'DEFAULT') {
    return true;
  }

  const safeCondition = condition;

  const resolveMaybeKeyValue = (fieldValueOrKey) => {
    // If first arg is a key name that exists on data, treat it as a key.
    // Otherwise treat it as the actual field value (e.g. contains(country, 'US')).
    if (
      typeof fieldValueOrKey === 'string' &&
      Object.prototype.hasOwnProperty.call(data, fieldValueOrKey)
    ) {
      return data[fieldValueOrKey];
    }
    return fieldValueOrKey;
  };

  const contains = (field, value) => {
    const v = resolveMaybeKeyValue(field);
    if (v == null) return false;
    return String(v).includes(value);
  };

  const startsWith = (field, value) => {
    const v = resolveMaybeKeyValue(field);
    if (v == null) return false;
    return String(v).startsWith(value);
  };

  const endsWith = (field, value) => {
    const v = resolveMaybeKeyValue(field);
    if (v == null) return false;
    return String(v).endsWith(value);
  };

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'data',
      'contains',
      'startsWith',
      'endsWith',
      `with (data) { return (${safeCondition}); }`
    );
    const result = fn(data, contains, startsWith, endsWith);
    return Boolean(result);
  } catch (e) {
    console.error('Error evaluating condition', condition, e);
    return false;
  }
}

module.exports = {
  evaluateCondition,
};

