import { BadRequestException, StandardSchemaValidationPipe } from '@nestjs/common';
import type { ApiErrorIssue } from '@epickem/shared';

/**
 * Valide chaque paramètre de route qui déclare un schéma Zod, par exemple
 * `@Body({ schema: createTournamentSchema })`. En cas d'échec : erreur 400 avec la liste
 * des champs invalides, mise en forme par AllExceptionsFilter.
 */
export function createValidationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    exceptionFactory: (issues) => {
      const details: ApiErrorIssue[] = issues.map((issue) => ({
        path: (issue.path ?? [])
          .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
          .join('.'),
        message: issue.message,
      }));
      return new BadRequestException({ message: 'Données invalides', issues: details });
    },
  });
}
