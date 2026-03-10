/**
 * Documentation Drift Detector
 *
 * Uses ts-morph to detect documentation drift by comparing
 * JSDoc comments with actual function signatures.
 */

import { Project, SourceFile, FunctionDeclaration, ParameterDeclaration, JSDoc, Type } from 'ts-morph';
import { DriftFinding, SeverityLevel } from '../../types';

/**
 * Drift detection options
 */
export interface DriftDetectionOptions {
  /** Check for missing JSDoc */
  checkMissingJsDoc?: boolean;
  /** Check for parameter mismatches */
  checkParamMismatch?: boolean;
  /** Check for return type mismatches */
  checkReturnMismatch?: boolean;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<DriftDetectionOptions> = {
  checkMissingJsDoc: true,
  checkParamMismatch: true,
  checkReturnMismatch: true,
};

/**
 * Generate a unique finding ID
 */
function generateFindingId(filePath: string, functionName: string, driftType: string): string {
  const hash = Buffer.from(`${filePath}:${functionName}:${driftType}`).toString('base64').slice(0, 12);
  return `DRIFT-${hash}`;
}

/**
 * Extract JSDoc parameters from comment text
 */
function parseJsDocParams(jsDoc: JSDoc): Array<{ name: string; type?: string; description?: string }> {
  const params: Array<{ name: string; type?: string; description?: string }> = [];

  const tags = jsDoc.getTags();
  for (const tag of tags) {
    if (tag.getTagName() === 'param') {
      const text = tag.getText();
      // Parse @param {Type} name description
      const match = text.match(/@param\s+(?:\{([^}]+)\}\s+)?(\w+)(?:\s+(.*))?/);
      if (match) {
        params.push({
          type: match[1],
          name: match[2],
          description: match[3],
        });
      }
    }
  }

  return params;
}

/**
 * Get the return type from JSDoc
 */
function parseJsDocReturnType(jsDoc: JSDoc): string | undefined {
  const tags = jsDoc.getTags();
  for (const tag of tags) {
    if (tag.getTagName() === 'returns' || tag.getTagName() === 'return') {
      const text = tag.getText();
      const match = text.match(/@returns?\s+(?:\{([^}]+)\})?/);
      return match?.[1];
    }
  }
  return undefined;
}

/**
 * Format a type for comparison
 */
function formatType(type: Type): string {
  const text = type.getText();
  // Normalize union types
  return text.replace(/\s*\|\s*/g, ' | ');
}

/**
 * Generate a JSDoc template for a function
 */
function generateJsDocTemplate(func: FunctionDeclaration): string {
  const name = func.getName() || 'anonymous';
  const params = func.getParameters();
  const returnType = func.getReturnType();

  let template = `/**\n`;
  template += ` * ${name}\n`;
  template += ` *\n`;

  for (const param of params) {
    const paramName = param.getName();
    const paramType = formatType(param.getType());
    const optional = param.isOptional() ? ' (optional)' : '';
    template += ` * @param {${paramType}} ${paramName}${optional}\n`;
  }

  const returnTypeText = formatType(returnType);
  if (returnTypeText !== 'void') {
    template += ` * @returns {${returnTypeText}}\n`;
  }

  template += ` */`;

  return template;
}

/**
 * Check a single function for documentation drift
 */
function checkFunction(
  func: FunctionDeclaration,
  sourceFile: SourceFile,
  options: Required<DriftDetectionOptions>
): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const functionName = func.getName() || 'anonymous';
  const filePath = sourceFile.getFilePath();
  const line = func.getStartLineNumber();

  // Skip non-exported functions if checking missing docs
  const isExported = func.isExported();

  // Get JSDoc
  const jsDocs = func.getJsDocs();
  const jsDoc = jsDocs.length > 0 ? jsDocs[0] : undefined;

  // Check for missing JSDoc
  if (options.checkMissingJsDoc && !jsDoc) {
    // Only report exported functions
    if (isExported) {
      findings.push({
        id: generateFindingId(filePath, functionName, 'missing-doc'),
        filePath,
        line,
        severity: 'medium' as SeverityLevel,
        driftType: 'missing-doc',
        title: `Missing JSDoc: ${functionName}()`,
        description: `Exported function "${functionName}" is missing JSDoc documentation.`,
        suggestion: 'Add JSDoc comments to document the function purpose, parameters, and return type.',
        expected: 'JSDoc comment block',
        actual: 'No documentation',
        functionName,
        suggestedJsDoc: generateJsDocTemplate(func),
      });
    }
    return findings;
  }

  if (!jsDoc) {
    return findings;
  }

  // Check parameter mismatches
  if (options.checkParamMismatch) {
    const jsDocParams = parseJsDocParams(jsDoc);
    const actualParams = func.getParameters();

    // Check for missing @param tags
    for (const param of actualParams) {
      const paramName = param.getName();
      const docParam = jsDocParams.find(p => p.name === paramName);

      if (!docParam) {
        findings.push({
          id: generateFindingId(filePath, functionName, `missing-param-${paramName}`),
          filePath,
          line,
          severity: 'medium' as SeverityLevel,
          driftType: 'param-mismatch',
          title: `Missing @param: ${paramName}`,
          description: `Parameter "${paramName}" in function "${functionName}" is not documented in JSDoc.`,
          suggestion: `Add @param tag for "${paramName}" to the JSDoc comment.`,
          expected: `Parameter "${paramName}" documented`,
          actual: 'Parameter not in JSDoc',
          functionName,
        });
      }
    }

    // Check for extra @param tags (documented but not in code)
    const actualParamNames = new Set(actualParams.map(p => p.getName()));
    for (const docParam of jsDocParams) {
      if (!actualParamNames.has(docParam.name)) {
        findings.push({
          id: generateFindingId(filePath, functionName, `extra-param-${docParam.name}`),
          filePath,
          line,
          severity: 'low' as SeverityLevel,
          driftType: 'deprecated-param',
          title: `Deprecated @param: ${docParam.name}`,
          description: `JSDoc documents parameter "${docParam.name}" which doesn't exist in function "${functionName}".`,
          suggestion: `Remove @param tag for "${docParam.name}" or update the function signature.`,
          expected: `Parameter "${docParam.name}" in function`,
          actual: 'Parameter not found in code',
          functionName,
        });
      }
    }
  }

  // Check return type mismatch
  if (options.checkReturnMismatch) {
    const jsDocReturnType = parseJsDocReturnType(jsDoc);
    const actualReturnType = formatType(func.getReturnType());

    if (jsDocReturnType && jsDocReturnType !== actualReturnType) {
      findings.push({
        id: generateFindingId(filePath, functionName, 'return-mismatch'),
        filePath,
        line,
        severity: 'medium' as SeverityLevel,
        driftType: 'return-mismatch',
        title: `Return Type Mismatch: ${functionName}()`,
        description: `JSDoc @returns type "${jsDocReturnType}" doesn't match actual return type "${actualReturnType}".`,
        suggestion: 'Update the @returns tag to match the actual return type.',
        expected: `Returns: ${actualReturnType}`,
        actual: `Returns: ${jsDocReturnType}`,
        functionName,
      });
    }
  }

  return findings;
}

/**
 * Detect documentation drift in a source file
 */
export function detectDriftInFile(
  sourceFile: SourceFile,
  options: DriftDetectionOptions = {}
): DriftFinding[] {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const findings: DriftFinding[] = [];

  // Check functions
  const functions = sourceFile.getFunctions();
  for (const func of functions) {
    findings.push(...checkFunction(func, sourceFile, mergedOptions));
  }

  // Check exported functions only for missing docs
  // (already handled in checkFunction)

  return findings;
}

/**
 * Detect documentation drift in a project
 */
export async function detectDrift(
  targetPath: string,
  tsConfigPath?: string,
  options: DriftDetectionOptions = {}
): Promise<DriftFinding[]> {
  const project = new Project({
    tsConfigFilePath: tsConfigPath,
    skipAddingFilesFromTsConfig: true,
  });

  // Add files from target path
  const stats = await import('fs/promises').then(fs => fs.stat(targetPath));

  if (stats.isFile()) {
    project.addSourceFileAtPath(targetPath);
  } else {
    project.addSourceFilesAtPaths(`${targetPath}/**/*.ts`);
  }

  const findings: DriftFinding[] = [];
  const sourceFiles = project.getSourceFiles();

  for (const sourceFile of sourceFiles) {
    findings.push(...detectDriftInFile(sourceFile, options));
  }

  return findings;
}

/**
 * Get summary statistics for drift findings
 */
export function getDriftSummary(findings: DriftFinding[]): {
  missingDocCount: number;
  paramMismatchCount: number;
  returnMismatchCount: number;
  deprecatedParamCount: number;
} {
  return {
    missingDocCount: findings.filter(f => f.driftType === 'missing-doc').length,
    paramMismatchCount: findings.filter(f => f.driftType === 'param-mismatch').length,
    returnMismatchCount: findings.filter(f => f.driftType === 'return-mismatch').length,
    deprecatedParamCount: findings.filter(f => f.driftType === 'deprecated-param').length,
  };
}
