import { DifyRunner } from '../dify/runner';
import type { CoreRepositories } from '../repo/interfaces';
import { ProcessStage } from './stages/process.stage';
import { PreprocessStage } from './stages/preprocess.stage';
import { RespondStage } from './stages/respond.stage';
import { ResultDecorateStage } from './stages/result-decorate.stage';
import { WakeCheckStage } from './stages/wake-check.stage';
import { RuntimePipelineScheduler } from './scheduler';

export const createDefaultPipelineScheduler = (runner: DifyRunner, repositories: CoreRepositories): RuntimePipelineScheduler => {
  return new RuntimePipelineScheduler().registerMany([
    new WakeCheckStage(),
    new PreprocessStage(),
    new ProcessStage(runner, repositories),
    new ResultDecorateStage(),
    new RespondStage()
  ]);
};
