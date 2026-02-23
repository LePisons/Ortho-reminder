import { Test, TestingModule } from '@nestjs/testing';
import { AlignerBatchesController } from './aligner-batches.controller';

describe('AlignerBatchesController', () => {
  let controller: AlignerBatchesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlignerBatchesController],
    }).compile();

    controller = module.get<AlignerBatchesController>(AlignerBatchesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
