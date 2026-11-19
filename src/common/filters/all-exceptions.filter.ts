import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Une erreur interne est survenue sur le serveur.';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || error;
      } else {
        message = exceptionResponse;
      }
    } else if (exception && typeof exception === 'object' && 'code' in exception) {
      // Gestion des erreurs Prisma courantes
      const prismaErr = exception as { code: string; meta?: any };
      if (prismaErr.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        const target = prismaErr.meta?.target;
        message = `Un enregistrement existe déjà avec cette valeur unique (${Array.isArray(target) ? target.join(', ') : 'champ unique'}).`;
        error = 'Conflict';
      } else if (prismaErr.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'L’enregistrement demandé est introuvable.';
        error = 'Not Found';
      } else if (prismaErr.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Contrainte de clé étrangère non respectée.';
        error = 'Foreign Key Constraint Failed';
      } else {
        this.logger.error(`Erreur non gérée: ${JSON.stringify(exception)}`);
      }
    } else {
      const errText =
        exception instanceof Error
          ? exception.stack || exception.message
          : String(exception);
      this.logger.error(`Exception inattendue: ${errText}`);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error,
      message,
    });
  }
}
