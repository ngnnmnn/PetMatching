import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PaymentSyncService } from './../src/modules/payment/payment-sync.service';
import { SpaReminderService } from './../src/modules/notifications/spa-reminder.service';

describe('Public API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PaymentSyncService)
      .useValue({})
      .overrideProvider(SpaReminderService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api/products?limit=1 (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/products?limit=1')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({
      data: expect.any(Array),
      meta: expect.objectContaining({
        total: expect.any(Number),
        page: 1,
        limit: 1,
        totalPages: expect.any(Number),
      }),
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
