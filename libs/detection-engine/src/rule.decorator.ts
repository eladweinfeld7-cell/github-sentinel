import { SetMetadata } from '@nestjs/common';
import { RuleName } from './enums';

export interface RuleMetadata {
  name: RuleName;
  description: string;
}

export const RULE_METADATA_KEY = 'DETECTION_RULE';

export const Rule = (metadata: RuleMetadata) =>
  SetMetadata(RULE_METADATA_KEY, metadata);
