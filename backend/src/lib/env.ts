const MIN_JWT_SECRET_LENGTH = 32;

/** Segredos que já circularam em exemplos/configs e não podem ir para produção. */
const BLOCKED_JWT_SECRETS = new Set([
  "change-me-in-production",
  "hospeda-dev-secret-change-me",
  "secret",
  "changeme",
]);

class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

const HOW_TO_GENERATE =
  'Gere um valor forte com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';

let cachedJwtSecret: string | null = null;

export function requireJwtSecret(): string {
  if (cachedJwtSecret) return cachedJwtSecret;

  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new EnvError(
      `JWT_SECRET não definido. A API não sobe sem ele. ${HOW_TO_GENERATE}`,
    );
  }

  if (BLOCKED_JWT_SECRETS.has(secret.toLowerCase())) {
    throw new EnvError(
      `JWT_SECRET está com um valor de exemplo público e precisa ser trocado. ${HOW_TO_GENERATE}`,
    );
  }

  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new EnvError(
      `JWT_SECRET precisa ter pelo menos ${MIN_JWT_SECRET_LENGTH} caracteres (atual: ${secret.length}). ${HOW_TO_GENERATE}`,
    );
  }

  cachedJwtSecret = secret;
  return cachedJwtSecret;
}

function requireDatabaseEnv(): void {
  const missing = ["DATABASE_USER", "DATABASE_NAME"].filter(
    (key) => !process.env[key]?.trim(),
  );

  if (missing.length > 0) {
    throw new EnvError(
      `Variáveis de banco ausentes: ${missing.join(", ")}. Confira o .env (veja .env.example).`,
    );
  }
}

/** Chamado no boot. Falha rápido em vez de subir com configuração insegura. */
export function validateEnv(): void {
  const problems: string[] = [];

  for (const check of [requireJwtSecret, requireDatabaseEnv]) {
    try {
      check();
    } catch (err) {
      problems.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (problems.length > 0) {
    console.error("\nConfiguração inválida — a API não foi iniciada:\n");
    for (const problem of problems) {
      console.error(`  • ${problem}`);
    }
    console.error("");
    process.exit(1);
  }
}
