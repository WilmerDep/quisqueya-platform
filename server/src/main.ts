import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './shared/api-exception.filter.js';

function resolveCorsOrigins() {
  const configured = process.env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured?.length) return configured;

  if (process.env.NODE_ENV === 'production') {
    return [
      'https://quisqueyatravel.com.do',
      'https://www.quisqueyatravel.com.do',
      'https://app.quisqueyatravel.com.do',
    ];
  }

  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });
  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ extended: true, limit: '12mb' }));
  app.setGlobalPrefix('api/v1', {
    exclude: ['/healthz'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());

  const port = Number(process.env.PORT || 3000);
  // Keep the existing network bind by default; QA can explicitly bind to
  // loopback to avoid exposing a private preview server to the local network.
  const host = process.env.QUISQUEYA_BIND_HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`Quisqueya Platform API listening on ${host}:${port}`);
}

bootstrap();
