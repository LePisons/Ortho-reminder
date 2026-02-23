import { Test, TestingModule } from '@nestjs/testing';
import { AlignerBatchesService } from './aligner-batches.service';

describe('AlignerBatchesService', () => {
  let service: AlignerBatchesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AlignerBatchesService],
    }).compile();

    service = module.get<AlignerBatchesService>(AlignerBatchesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
