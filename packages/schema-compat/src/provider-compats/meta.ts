import type { JSONSchema7 } from 'json-schema';
import type { Targets } from 'zod-to-json-schema';
import {
  isArraySchema,
  isObjectSchema,
  isNumberSchema,
  isStringSchema,
  isUnionSchema,
  isNullableSchema,
} from '../json-schema/utils';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ZodType } from '../schema.types';
import type { ModelInformation } from '../types';

export class MetaSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return this.getModel().modelId.includes('meta');
  }

  processZodType(value: ZodType): ZodType {
    // No Zod-level transformations needed for Meta - all processing is done at JSON Schema level
    return value;
  }

  preProcessJSONNode(schema: JSONSchema7, parentSchema?: JSONSchema7): void {
    // Process based on schema type
    if (isObjectSchema(schema)) {
      this.defaultObjectHandler(schema);
    } else if (isArraySchema(schema)) {
      this.defaultArrayHandler(schema);
    } else if (isNumberSchema(schema)) {
      // Skip number constraint processing if this field has a default value
      // When a number has a default, we should keep min/max constraints as-is
      if (schema.default !== undefined) {
        // Don't process - keep minimum/maximum intact
        return;
      }
      this.defaultNumberHandler(schema);
    } else if (isStringSchema(schema)) {
      // Skip string format processing if this is inside a nullable anyOf pattern
      // (e.g., z.date().nullable() produces anyOf: [{type: "string", format: "date-time"}, {type: "null"}])
      // We want to keep the format in that case
      const isInsideNullableAnyOf = parentSchema && isNullableSchema(parentSchema);
      if (isInsideNullableAnyOf && (schema.format === 'date-time' || schema.format === 'date')) {
        // Don't process date/date-time formats inside nullable patterns - keep the format
        return;
      }
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

      // Fix required array: remove fields that have default values
      if (schema.required && Array.isArray(schema.required) && schema.properties) {
        schema.required = schema.required.filter((propName: string) => {
          const prop = schema.properties?.[propName];
          if (typeof prop === 'object' && prop !== null && 'default' in prop) {
            return false; // Remove from required if it has a default
          }
          return true;
        });
        // Clean up empty required array
        if (schema.required.length === 0) {
          delete schema.required;
        }
      }

      // Fix record schemas: remove propertyNames (v4 adds this but it's not needed)
      if ('propertyNames' in schema) {
        delete (schema as Record<string, unknown>).propertyNames;
      }
    }
  }
}
