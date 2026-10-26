import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { ApiError, ApiErrorIssue } from '@epickem/shared';

/**
 * Attrape toutes les erreurs des routes HTTP et les renvoie au format ApiError.
 * Une erreur inattendue (bug, base injoignable…) devient une 500 au message générique :
 * son détail ne part jamais au client, il est seulement écrit dans les logs.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toApiError(exception);
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    const { httpAdapter } = this.adapterHost;
    httpAdapter.reply(host.switchToHttp().getResponse(), body, body.statusCode);
  }
}

function toApiError(exception: unknown): ApiError {
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    const details =
      typeof response === 'string'
        ? { message: response }
        : (response as { message?: unknown; issues?: ApiErrorIssue[] });
    return {
      statusCode,
      error: statusName(statusCode),
      message: typeof details.message === 'string' ? details.message : exception.message,
      ...(details.issues && { issues: details.issues }),
    };
  }

  if (isExpressClientError(exception)) {
    return {
      statusCode: exception.statusCode,
      error: statusName(exception.statusCode),
      message: exception.message,
    };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: statusName(HttpStatus.INTERNAL_SERVER_ERROR),
    message: 'Erreur interne du serveur',
  };
}

function statusName(statusCode: number): string {
  return (HttpStatus[statusCode] as string | undefined) ?? 'ERROR';
}

/**
 * Erreur levée par Express avant d'atteindre Nest, par exemple un JSON mal formé.
 * `expose` indique que son message peut être montré au client (erreurs 4xx uniquement).
 */
function isExpressClientError(exception: unknown): exception is Error & { statusCode: number } {
  return (
    exception instanceof Error &&
    'statusCode' in exception &&
    typeof exception.statusCode === 'number' &&
    'expose' in exception &&
    exception.expose === true
  );
}
