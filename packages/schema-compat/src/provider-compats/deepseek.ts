import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { isArraySchema, isObjectSchema, isStringSchema, isUnionSchema } from '../json-schema/utils';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ZodType } from '../schema.types';
import type { ModelInformation } from '../types';
import { isOptional, isObj, isArr, isUnion, isString } from '../zodTypes';

export class DeepSeekSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    // Deepseek R1 performs perfectly without this compat layer
    return this.getModel().modelId.includes('deepseek') && !this.getModel().modelId.includes('r1');
  }

  processZodType(value: ZodType): ZodType {
    if (isOptional(z)(value)) {
      return this.defaultZodOptionalHandler(value, ['ZodObject', 'ZodArray', 'ZodUnion', 'ZodString', 'ZodNumber']);
    } else if (isObj(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr(z)(value)) {
      return this.defaultZodArrayHandler(value, ['min', 'max']);
    } else if (isUnion(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isString(z)(value)) {
      return this.defaultZodStringHandler(value);
    }

    return value;
  }

  preProcessJSONNode(schema: JSONSchema7, _parentSchema?: JSONSchema7): void {
    // Process based on schema type
    if (isObjectSchema(schema)) {
      this.defaultObjectHandler(schema);
    } else if (isArraySchema(schema)) {
      // DeepSeek doesn't respect min/max array constraints, so convert them to description
      this.defaultArrayHandler(schema);
    } else if (isStringSchema(schema)) {
      // DeepSeek doesn't respect string constraints, so convert them to description
      this.defaultStringHandler(schema);
    }
  }

  postProcessJSONNode(schema: JSONSchema7): void {
    // Handle union schemas in post-processing (after children are processed)
    if (isUnionSchema(schema)) {
      this.defaultUnionHandler(schema);
    }

    // Fix v4-specific issues in post-processing
    if (isObjectSchema(schema)) {
      // Fix passthrough objects: convert additionalProperties: {} to additionalProperties: true
      if (
        schema.additionalProperties !== undefined &&
        typeof schema.additionalProperties === 'object' &&
        schema.additionalProperties !== null &&
        Object.keys(schema.additionalProperties).length === 0
      ) {
        schema.additionalProperties = true;
      }

      // Fix record schemas: remove propertyNames (v4 adds this but it's not needed)
      if ('propertyNames' in schema) {
        delete (schema as Record<string, unknown>).propertyNames;
      }
    }
  }
}
