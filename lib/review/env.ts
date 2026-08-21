export class MissingEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingEnvError";
  }
}

export function getAnthropicConfig(): { apiKey: string; model: string } {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;

  if (!apiKey) {
    throw new MissingEnvError(
      "ANTHROPIC_API_KEY 환경변수가 비어 있습니다. .env.local에 값을 설정하세요.",
    );
  }
  if (!model) {
    throw new MissingEnvError(
      "ANTHROPIC_MODEL 환경변수가 비어 있습니다. .env.local에 값을 설정하세요 (모델 ID 하드코딩 금지).",
    );
  }

  return { apiKey, model };
}
