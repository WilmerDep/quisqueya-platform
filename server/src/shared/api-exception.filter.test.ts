import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from './api-exception.filter.js';

describe('ApiExceptionFilter (Global Exception Handling)', () => {
  const createMockArgumentsHost = () => {
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const responseMock = { status: statusMock };

    const hostMock = {
      switchToHttp: () => ({
        getResponse: () => responseMock,
      }),
    } as unknown as ArgumentsHost;

    return { hostMock, statusMock, jsonMock };
  };

  it('handles ECONNREFUSED error returning safe HTTP 503 without sensitive details', () => {
    const filter = new ApiExceptionFilter();
    const { hostMock, statusMock, jsonMock } = createMockArgumentsHost();

    const dbError = new Error('connect ECONNREFUSED 127.0.0.1:3306');
    filter.catch(dbError, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(jsonMock).toHaveBeenCalledWith({
      error: {
        code: 503,
        message: 'No fue posible conectar con el servicio. Verifica que el servidor y la base de datos estén disponibles.',
      },
    });

    const responseBody = JSON.stringify(jsonMock.mock.calls[0][0]);
    expect(responseBody).not.toContain('127.0.0.1');
    expect(responseBody).not.toContain('3306');
    expect(responseBody).not.toContain('ECONNREFUSED');
  });

  it('handles database pool timeout error returning safe HTTP 503', () => {
    const filter = new ApiExceptionFilter();
    const { hostMock, statusMock, jsonMock } = createMockArgumentsHost();

    const timeoutError = {
      code: '45028',
      message: 'pool timeout: failed to retrieve a connection from pool after 10000ms',
    };

    filter.catch(timeoutError, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(jsonMock).toHaveBeenCalledWith({
      error: {
        code: 503,
        message: 'No fue posible conectar con el servicio. Verifica que el servidor y la base de datos estén disponibles.',
      },
    });
  });

  it('handles non-database HttpExceptions normally (e.g. 400 Bad Request)', () => {
    const filter = new ApiExceptionFilter();
    const { hostMock, statusMock, jsonMock } = createMockArgumentsHost();

    const badRequest = new BadRequestException('Credenciales inválidas.');
    filter.catch(badRequest, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith({
      error: {
        code: 400,
        message: 'Credenciales inválidas.',
      },
    });
  });
});
