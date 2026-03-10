/**
 * JSDoc Generator
 *
 * Generates JSDoc templates for undocumented functions.
 * Uses ts-morph to extract accurate type information.
 */

import { Project, SourceFile, FunctionDeclaration, ClassDeclaration, MethodDeclaration } from 'ts-morph';

/**
 * Generated JSDoc result
 */
export interface GeneratedJsDoc {
  /** Function name */
  functionName: string;
  /** File path */
  filePath: string;
  /** Line number */
  line: number;
  /** Generated JSDoc template */
  jsDoc: string;
  /** Whether the function already had JSDoc */
  hadExistingJsDoc: boolean;
}

/**
 * Format a type for JSDoc
 */
function formatType(typeText: string): string {
  // Clean up type text for JSDoc
  return typeText.replace(/\s+/g, ' ').trim();
}

/**
 * Generate JSDoc for a function
 */
function generateFunctionJsDoc(func: FunctionDeclaration): string {
  const name = func.getName() || 'anonymous';
  const params = func.getParameters();
  const returnType = func.getReturnType();
  const jsDocs = func.getJsDocs();

  // If there's existing JSDoc, preserve it and add missing parts
  if (jsDocs.length > 0) {
    return generatePreservedJsDoc(func, jsDocs[0]);
  }

  // Generate new JSDoc
  let jsDoc = `/**\n`;
  jsDoc += ` * ${name}\n`;
  jsDoc += ` *\n`;

  for (const param of params) {
    const paramName = param.getName();
    const paramType = formatType(param.getType().getText());
    const optional = param.isOptional();
    const defaultValue = param.hasInitializer() ? ` (default: ${param.getInitializer()?.getText()})` : '';
    const optionalMarker = optional ? ' (optional)' : '';

    jsDoc += ` * @param {${paramType}} ${paramName}${optionalMarker}${defaultValue}\n`;
  }

  const returnTypeText = formatType(returnType.getText());
  if (returnTypeText !== 'void' && returnTypeText !== 'undefined') {
    jsDoc += ` * @returns {${returnTypeText}}\n`;
  }

  jsDoc += ` */`;

  return jsDoc;
}

/**
 * Generate JSDoc preserving existing content
 */
function generatePreservedJsDoc(func: FunctionDeclaration, existingJsDoc: import('ts-morph').JSDoc): string {
  const params = func.getParameters();
  const returnType = func.getReturnType();

  // Parse existing @param tags
  const existingParams = new Map<string, string>();
  const tags = existingJsDoc.getTags();

  for (const tag of tags) {
    if (tag.getTagName() === 'param') {
      const text = tag.getText();
      const match = text.match(/@param\s+(?:\{([^}]+)\}\s+)?(\w+)(?:\s+(.*))?/);
      if (match) {
        existingParams.set(match[2], match[3] || '');
      }
    }
  }

  // Build new JSDoc
  let jsDoc = `/**\n`;

  // Preserve description
  const comment = existingJsDoc.getComment();
  if (comment) {
    const commentText = typeof comment === 'string' ? comment : comment.map(c => c.getText()).join(' ');
    jsDoc += ` * ${commentText}\n`;
    jsDoc += ` *\n`;
  }

  // Add/update @param tags
  for (const param of params) {
    const paramName = param.getName();
    const paramType = formatType(param.getType().getText());
    const existingDesc = existingParams.get(paramName);

    if (existingDesc) {
      jsDoc += ` * @param {${paramType}} ${paramName} ${existingDesc}\n`;
    } else {
      const optional = param.isOptional() ? ' (optional)' : '';
      jsDoc += ` * @param {${paramType}} ${paramName}${optional}\n`;
    }
  }

  // Add @returns if not present
  const hasReturns = tags.some(t => t.getTagName() === 'returns' || t.getTagName() === 'return');
  if (!hasReturns) {
    const returnTypeText = formatType(returnType.getText());
    if (returnTypeText !== 'void' && returnTypeText !== 'undefined') {
      jsDoc += ` * @returns {${returnTypeText}}\n`;
    }
  }

  jsDoc += ` */`;

  return jsDoc;
}

/**
 * Generate JSDoc for a class method
 */
function generateMethodJsDoc(method: MethodDeclaration): string {
  const name = method.getName();
  const params = method.getParameters();
  const returnType = method.getReturnType();

  let jsDoc = `/**\n`;
  jsDoc += ` * ${name}\n`;
  jsDoc += ` *\n`;

  for (const param of params) {
    const paramName = param.getName();
    const paramType = formatType(param.getType().getText());
    const optional = param.isOptional() ? ' (optional)' : '';

    jsDoc += ` * @param {${paramType}} ${paramName}${optional}\n`;
  }

  const returnTypeText = formatType(returnType.getText());
  if (returnTypeText !== 'void' && returnTypeText !== 'undefined') {
    jsDoc += ` * @returns {${returnTypeText}}\n`;
  }

  jsDoc += ` */`;

  return jsDoc;
}

/**
 * Generate JSDoc templates for all undocumented functions in a file
 */
export function generateJsDocTemplates(
  sourceFile: SourceFile,
  includeExisting = false
): GeneratedJsDoc[] {
  const results: GeneratedJsDoc[] = [];

  // Process functions
  const functions = sourceFile.getFunctions();
  for (const func of functions) {
    const jsDocs = func.getJsDocs();
    const hasJsDoc = jsDocs.length > 0;

    if (!hasJsDoc || includeExisting) {
      results.push({
        functionName: func.getName() || 'anonymous',
        filePath: sourceFile.getFilePath(),
        line: func.getStartLineNumber(),
        jsDoc: generateFunctionJsDoc(func),
        hadExistingJsDoc: hasJsDoc,
      });
    }
  }

  // Process class methods
  const classes = sourceFile.getClasses();
  for (const cls of classes) {
    const methods = cls.getMethods();
    for (const method of methods) {
      const jsDocs = method.getJsDocs();
      const hasJsDoc = jsDocs.length > 0;

      if (!hasJsDoc || includeExisting) {
        results.push({
          functionName: `${cls.getName()}.${method.getName()}()`,
          filePath: sourceFile.getFilePath(),
          line: method.getStartLineNumber(),
          jsDoc: generateMethodJsDoc(method),
          hadExistingJsDoc: hasJsDoc,
        });
      }
    }
  }

  return results;
}

/**
 * Generate JSDoc templates for a project
 */
export async function generateJsDocForProject(
  targetPath: string,
  tsConfigPath?: string,
  includeExisting = false
): Promise<GeneratedJsDoc[]> {
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

  const results: GeneratedJsDoc[] = [];
  const sourceFiles = project.getSourceFiles();

  for (const sourceFile of sourceFiles) {
    results.push(...generateJsDocTemplates(sourceFile, includeExisting));
  }

  return results;
}

/**
 * Get summary of JSDoc generation
 */
export function getGenerationSummary(results: GeneratedJsDoc[]): {
  totalFunctions: number;
  undocumentedCount: number;
  documentedCount: number;
} {
  return {
    totalFunctions: results.length,
    undocumentedCount: results.filter(r => !r.hadExistingJsDoc).length,
    documentedCount: results.filter(r => r.hadExistingJsDoc).length,
  };
}
