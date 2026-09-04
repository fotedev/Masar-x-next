/**
 * RFC-4122-shaped v4 identifier for client-generated ids.
 *
 * Hermes (React Native 0.74) does not expose crypto.randomUUID, and we
 * intentionally avoid the react-native-get-random-values polyfill to
 * keep the dependency set lean. The generated ids are only used as
 * non-sensitive correlation identifiers (AI conversation id, optimistic
 * list keys) - never as security tokens.
 */
export function uuid4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}