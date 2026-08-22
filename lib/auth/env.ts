export class MissingEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingEnvError";
  }
}

export function getSharedPassword(): string {
  const password = process.env.REVIEW_SHARED_PASSWORD;
  if (!password) {
    throw new MissingEnvError(
      "REVIEW_SHARED_PASSWORD 환경변수가 비어 있습니다. 배포 환경에서는 반드시 설정해야 합니다.",
    );
  }
  return password;
}
