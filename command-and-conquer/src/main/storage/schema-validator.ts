import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';

export class SchemaValidator {
  private ajv: Ajv2020;

  constructor(schemasDir: string) {
    this.ajv = new Ajv2020({ allErrors: true });
    addFormats(this.ajv);

    if (fs.existsSync(schemasDir)) {
      const files = fs.readdirSync(schemasDir);
      for (const file of files) {
        if (file.endsWith('.schema.json')) {
          const schemaPath = path.join(schemasDir, file);
          const schemaText = fs.readFileSync(schemaPath, 'utf-8');
          try {
            const schemaJson = JSON.parse(schemaText);
            const schemaName = file.replace('.schema.json', '');
            this.ajv.addSchema(schemaJson, schemaName);
          } catch (e) {
            console.error(`Failed to parse schema file ${file}`, e);
          }
        }
      }
    }
  }

  /**
   * Validates data against a specific schema by name
   */
  validate(schemaName: string, data: unknown): { valid: boolean; errors: string[] } {
    const validateFn = this.ajv.getSchema(schemaName);
    if (!validateFn) {
      return { valid: false, errors: [`Schema '${schemaName}' not found.`] };
    }

    const valid = validateFn(data);
    if (!valid && validateFn.errors) {
      return {
        valid: false,
        errors: validateFn.errors.map(err => `${err.instancePath} ${err.message}`.trim())
      };
    }
    
    return { valid: true, errors: [] };
  }
}
