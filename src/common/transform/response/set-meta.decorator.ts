import { SetMetadata } from '@nestjs/common';

export const SET_META_KEY = 'setMeta';
export const SetMeta = (meta: Record<string, unknown>): MethodDecorator =>
  SetMetadata(SET_META_KEY, meta);
