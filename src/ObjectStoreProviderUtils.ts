/**
 * ObjectStoreProviderUtils.ts
 * Author: David de Regt
 * Copyright: Microsoft 2015
 *
 * Reusable helper functions for ObjectStoreProvider providers/transactions/etc.
 */

import {
  map,
  isArray,
  some,
  isNull,
  isDate,
  get,
  isUndefined,
  isObject,
} from "lodash";

import { KeyComponentType, KeyPathType, KeyType } from "./ObjectStoreProvider";

// Extending interfaces that should be in lib.d.ts but aren't for some reason.
declare global {
  interface Document {
    documentMode: number;
  }
}

// Max array length (uint): 2^32 - 1
export const MAX_COUNT = 4294967295;

export function isIE() {
  return (
    (typeof document !== "undefined" &&
      document.all !== null &&
      document.documentMode <= 11) ||
    (typeof navigator !== "undefined" &&
      !!navigator.userAgent &&
      navigator.userAgent.indexOf("Edge/") !== -1)
  );
}

export function isSafari() {
  return (
    typeof navigator !== "undefined" &&
    ((navigator.userAgent.indexOf("Safari") !== -1 &&
      navigator.userAgent.indexOf("Chrome") === -1 &&
      navigator.userAgent.indexOf("BB10") === -1) ||
      navigator.userAgent.indexOf("Mobile Crosswalk") !== -1)
  );
}

export function arrayify<T>(obj: T | T[]): T[] {
  return isArray(obj) ? <T[]>obj : [<T>obj];
}

export function trimArray<TValue>(
  array: Array<TValue>,
  trimLength: number
): Array<TValue> {
  if (trimLength < 0 || array.length < trimLength) {
    return array.slice();
  }

  let ret = new Array<TValue>(trimLength);
  for (let j = 0; j < trimLength; j++) {
    ret[j] = array[j];
  }
  return ret;
}

// Constant string for joining compound keypaths for websql and IE indexeddb.  There may be marginal utility in using a more obscure
// string sequence.
const keypathJoinerString = "%&";

// This function computes a serialized single string value for a keypath on an object.  This is used for generating ordered string keys
// for compound (or non-compound) values.
export function getSerializedKeyForKeypath(
  obj: any,
  keyPathRaw: KeyPathType
): string | undefined {
  const values = getKeyForKeypath(obj, keyPathRaw);
  if (values === undefined) {
    return undefined;
  }

  return serializeKeyToString(values, keyPathRaw);
}

export function getKeyForKeypath(
  obj: any,
  keyPathRaw: KeyPathType
): KeyType | undefined {
  const keyPathArray = arrayify(keyPathRaw);

  const values = map(keyPathArray, (kp) => getValueForSingleKeypath(obj, kp));
  if (some(values, (val) => isNull(val) || isUndefined(val))) {
    // If any components of the key are null/undefined, then the result is undefined
    return undefined;
  }

  if (!isArray(keyPathRaw)) {
    return values[0];
  } else {
    return values;
  }
}

// Internal helper function for getting a value out of a standard keypath.
export function getValueForSingleKeypath(obj: any, singleKeyPath: string): any {
  return get(obj, singleKeyPath, undefined);
}

export function isCompoundKeyPath(keyPath: KeyPathType) {
  return isArray(keyPath) && keyPath.length > 1;
}

export function formListOfKeys(
  keyOrKeys: KeyType | KeyType[],
  keyPath: KeyPathType
): any[] {
  if (isCompoundKeyPath(keyPath)) {
    if (!isArray(keyOrKeys)) {
      throw new Error(
        "formListOfKeys called with a compound keypath (" +
          JSON.stringify(keyPath) +
          ") but a non-compound keyOrKeys (" +
          JSON.stringify(keyOrKeys) +
          ")"
      );
    }
    if (!isArray(keyOrKeys[0])) {
      // Looks like a single compound key, so make it a list of a single key
      return [keyOrKeys];
    }

    // Array of arrays, so looks fine
    return keyOrKeys;
  }

  // Non-compound, so just make sure it's a list when it comes out in case it's a single key passed
  return arrayify(keyOrKeys);
}

export function serializeValueToOrderableString(val: KeyComponentType): string {
  if (typeof val === "number") {
    return "A" + serializeNumberToOrderableString(val as number);
  }
  if (isDate(val)) {
    return "B" + serializeNumberToOrderableString((val as Date).getTime());
  }
  if (typeof val === "string") {
    return "C" + (val as string);
  }

  const type = isObject(val)
    ? Object.getPrototypeOf(val).constructor
    : typeof val;
  throw new Error(
    "Type '" +
      type +
      "' unsupported at this time.  Only numbers, Dates, and strings are currently supported."
  );
}

const zeroes = "0000000000000000";

function formatFixed(n: number, digits: number): string {
  var result = String(n);
  var prefix = digits - result.length;

  if (prefix > 0 && prefix < zeroes.length) {
    result = zeroes.substr(0, prefix) + result;
  }

  return result;
}

export function serializeNumberToOrderableString(n: number) {
  if (n === 0 || isNaN(n) || !isFinite(n)) {
    return String(n);
  }

  var isPositive = true;

  if (n < 0) {
    isPositive = false;
    n = -n;
  }

  var exponent = Math.floor(Math.log(n) / Math.LN10);

  n = n / Math.pow(10, exponent);

  if (isPositive) {
    return formatFixed(1024 + exponent, 4) + String(n);
  } else {
    return "-" + formatFixed(1024 - exponent, 4) + String(10 - n);
  }
}

export function serializeKeyToString(
  key: KeyType,
  keyPath: KeyPathType
): string {
  if (isCompoundKeyPath(keyPath)) {
    if (isArray(key)) {
      return map(key, (k) => serializeValueToOrderableString(k)).join(
        keypathJoinerString
      );
    } else {
      throw new Error(
        "serializeKeyToString called with a compound keypath (" +
          JSON.stringify(keyPath) +
          ") but a non-compound key (" +
          JSON.stringify(key) +
          ")"
      );
    }
  } else {
    if (isArray(key)) {
      throw new Error(
        "serializeKeyToString called with a non-compound keypath (" +
          JSON.stringify(keyPath) +
          ") but a compound key (" +
          JSON.stringify(key) +
          ")"
      );
    } else {
      return serializeValueToOrderableString(key);
    }
  }
}

export function formListOfSerializedKeys(
  keyOrKeys: KeyType | KeyType[],
  keyPath: KeyPathType
): string[] {
  return map(formListOfKeys(keyOrKeys, keyPath), (key) =>
    serializeKeyToString(key, keyPath)
  );
}
