import { Test, TestingModule } from '@nestjs/testing';
import { ReevaluationsController } from './reevaluations.controller';

describe('ReevaluationsController', () => {
  let controller: ReevaluationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReevaluationsController],
    }).compile();

    controller = module.get<ReevaluationsController>(ReevaluationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
