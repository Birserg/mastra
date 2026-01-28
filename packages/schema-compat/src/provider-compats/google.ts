import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodObject as ZodObjectV3 } from 'zod/v3';
import type { ZodObject as ZodObjectV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import { isArraySchema, isNumberSchema, isObjectSchema, isStringSchema, isUnionSchema } from '../json-schema/utils';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ZodType } from '../schema.types';
import type { ModelInformation } from '../types';
import { isOptional, isNull, isObj, isArr, isUnion, isString, isNumber } from '../zodTypes';

export class GoogleSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return this.getModel().provider.includes('google') || this.getModel().modelId.includes('google');
  }
  processZodType(value: ZodType): ZodType {
    if (isOptional(z)(value)) {
      return this.defaultZodOptionalHandler(value, ['ZodObject', 'ZodArray', 'ZodUnion', 'ZodString', 'ZodNumber']);
    } else if (isNull(z)(value)) {
      // Google models don't support null, so we need to convert it to any and then refine it to null
      return z
        .any()
        .refine(v => v === null, { message: 'must be null' })
        .describe(value.description || 'must be null');
    } else if (isObj(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr(z)(value)) {
      return this.defaultZodArrayHandler(value, []);
    } else if (isUnion(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isString(z)(value)) {
      // Google models support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      return this.defaultZodStringHandler(value);
    } else if (isNumber(z)(value)) {
      // Google models support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      return this.defaultZodNumberHandler(value);
    }
    return this.defaultUnsupportedZodTypeHandler(value as ZodObjectV4<any> | ZodObjectV3<any>);
  }

  preProcessJSONNode(schema: JSONSchema7, _parentSchema?: JSONSchema7): void {
    // Process based on schema type
    if (isObjectSchema(schema)) {
      this.defaultObjectHandler(schema);
    } else if (isArraySchema(schema)) {
      this.defaultArrayHandler(schema);
    } else if (isStringSchema(schema)) {
      // Google models don't respect string constraints, so convert them to description
      this.defaultStringHandler(schema);
    } else if (isNumberSchema(schema)) {
      // Google models don't respect number constraints, so convert them to description
      this.defaultNumberHandler(schema);
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
