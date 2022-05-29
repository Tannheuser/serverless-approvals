export const stringify = (value: object | string | number) => {
  const lastKey = Object.keys(value).pop();
  let objString = '';

  if (typeof value === 'object') {
    objString += '{';
    // eslint-disable-next-line guard-for-in
    for (const key in value) {
      if ((value as any)[key] === null || typeof (value as any)[key] === 'undefined') {
        if (key === lastKey) {
          objString = objString.substring(0, objString.length - 1);
        }
      } else {
        objString += `'${key}':${stringify((value as any)[key])}`;
        if (key !== lastKey) {
          objString += ',';
        }
      }
    }
    objString += '}';
  } else if (typeof value === 'string') {
    objString += `'${value.replace(/'/g, "''")}'`;
  } else {
    objString += `${value}`;
  }

  return objString;
};
