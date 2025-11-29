const rawVersion = process.env.APP_VERSION || '0.0.0-local';

export function getAppVersion(): string {
  return rawVersion;
}
