import { SetMetadata } from '@nestjs/common';
import { Modules } from '../enum/modules.enum';

export const MODULES_KEY = 'modules';
export const ACTION_KEY = 'module_action';

export type ModuleAction = 'create' | 'update' | 'delete';

export const RequireModule = (...modules: Modules[]) =>
  SetMetadata(MODULES_KEY, modules);

export const RequireAction = (action: ModuleAction) =>
  SetMetadata(ACTION_KEY, action);
