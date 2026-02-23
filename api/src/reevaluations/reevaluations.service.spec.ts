import { Test, TestingModule } from '@nestjs/testing';
import { ReevaluationsService } from './reevaluations.service';

describe('ReevaluationsService', () => {
  let service: ReevaluationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReevaluationsService],
    }).compile();

    service = module.get<ReevaluationsService>(ReevaluationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
