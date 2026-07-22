import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isDbError =
      exception &&
      typeof exception === 'object' &&
      (('code' in exception && (exception as { code: string }).code === '45028') ||
        ('message' in exception &&
          typeof (exception as { message: string }).message === 'string' &&
          ((exception as { message: string }).message.includes('ECONNREFUSED') ||
            (exception as { message: string }).message.includes('pool timeout') ||
            (exception as { message: string }).message.includes('Can\'t connect to MySQL'))));

    if (isDbError) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: {
          code: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'No fue posible conectar con el servicio. Verifica que el servidor y la base de datos estén disponibles.',
        },
      });
      return;
    }

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? (payload as { message: string | string[] }).message
        : exception instanceof Error
          ? exception.message
          : 'Unexpected server error';

    response.status(status).json({
      error: {
        code: status,
        message,
      },
    });
  }
}
