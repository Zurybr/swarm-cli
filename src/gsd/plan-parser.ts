/**
 * PLAN.md Parser - Issue #15
 * Sistema de parsing para archivos PLAN.md con frontmatter YAML
 */

import * as yaml from 'yaml';
import { 
  PlanFrontmatter, 
  PlanTask, 
  ValidationResult,
  CheckpointConfig 
} from '../types';

export class PlanParser {
  private readonly requiredFields = ['phase', 'plan', 'type', 'wave'];
  
  /**
   * Parsea un archivo PLAN.md completo
   */
  parse(content: string): { frontmatter: PlanFrontmatter; tasks: PlanTask[] } {
    const { frontmatterYaml, tasksXml } = this.extractSections(content);
    
    const frontmatter = this.parseFrontmatter(frontmatterYaml);
    const tasks = this.parseTasks(tasksXml);
    
    return { frontmatter, tasks };
  }
  
  /**
   * Extrae las secciones de frontmatter y tasks del contenido
   */
  private extractSections(content: string): { frontmatterYaml: string; tasksXml: string } {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      throw new Error('No se encontró frontmatter YAML válido');
    }
    
    const frontmatterYaml = frontmatterMatch[1];
    const tasksXml = content.slice(frontmatterMatch[0].length).trim();
    
    return { frontmatterYaml, tasksXml };
  }
  
  /**
   * Parsea el frontmatter YAML
   */
  parseFrontmatter(yamlContent: string): PlanFrontmatter {
    const parsed = yaml.parse(yamlContent);
    
    // Validar campos requeridos
    for (const field of this.requiredFields) {
      if (parsed[field] === undefined) {
        throw new Error(`Campo requerido faltante en frontmatter: ${field}`);
      }
    }
    
    return {
      phase: parsed.phase,
      plan: parsed.plan,
      type: parsed.type,
      wave: parsed.wave,
      depends_on: parsed.depends_on || [],
      files_modified: parsed.files_modified || [],
      autonomous: parsed.autonomous ?? true,
      requirements: parsed.requirements || [],
      user_setup: parsed.user_setup,
      dashboard_config: parsed.dashboard_config,
      must_haves: parsed.must_haves
    };
  }
  
  /**
   * Parsea las tareas en formato XML-like
   */
  parseTasks(xmlContent: string): PlanTask[] {
    const tasks: PlanTask[] = [];
    const taskRegex = /<task\s+([^>]+)>([\s\S]*?)<\/task>/g;
    
    let match;
    while ((match = taskRegex.exec(xmlContent)) !== null) {
      const attributes = this.parseAttributes(match[1]);
      const content = match[2];
      
      const task: PlanTask = {
        type: attributes.type === 'checkpoint' ? 'checkpoint' : 'auto',
        name: this.extractTagContent(content, 'name'),
        action: this.extractTagContent(content, 'action'),
        files: this.extractTagContent(content, 'files')?.split(',').map(f => f.trim()),
        verify: this.extractTagContent(content, 'verify'),
        done: this.extractTagContent(content, 'done'),
        tdd: attributes.tdd === 'true',
      };
      
      if (task.type === 'checkpoint') {
        task.checkpoint = this.parseCheckpoint(content);
      }
      
      tasks.push(task);
    }
    
    return tasks;
  }
  
  /**
   * Parsea atributos de una etiqueta XML
   */
  private parseAttributes(attrString: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)="([^"]*)"/g;
    
    let match;
    while ((match = attrRegex.exec(attrString)) !== null) {
      attrs[match[1]] = match[2];
    }
    
    return attrs;
  }
  
  /**
   * Extrae el contenido de una etiqueta XML
   */
  private extractTagContent(xml: string, tag: string): string | undefined {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
    const match = xml.match(regex);
    return match ? match[1].trim() : undefined;
  }
  
  /**
   * Parsea configuración de checkpoint
   */
  private parseCheckpoint(content: string): CheckpointConfig {
    return {
      type: this.extractTagContent(content, 'type') as any || 'human-verify',
      gate: (this.extractTagContent(content, 'gate') as any) || 'blocking',
      what_built: this.extractTagContent(content, 'what-built') || '',
      how_to_verify: this.extractTagContent(content, 'how-to-verify') || '',
      resume_signal: this.extractTagContent(content, 'resume-signal') || '',
    };
  }
  
  /**
   * Valida un frontmatter de PLAN.md
   */
  validateFrontmatter(frontmatter: PlanFrontmatter): ValidationResult {
    const errors: string[] = [];
    
    // Validar campos requeridos
    for (const field of this.requiredFields) {
      if ((frontmatter as any)[field] === undefined) {
        errors.push(`Campo requerido faltante: ${field}`);
      }
    }
    
    // Validar tipo
    const validTypes = ['execute', 'tdd', 'checkpoint'];
    if (!validTypes.includes(frontmatter.type)) {
      errors.push(`Tipo inválido: ${frontmatter.type}. Debe ser uno de: ${validTypes.join(', ')}`);
    }
    
    // Validar wave
    if (frontmatter.wave < 1) {
      errors.push('El número de wave debe ser mayor o igual a 1');
    }
    
    // Validar must_haves si existen
    if (frontmatter.must_haves) {
      if (frontmatter.must_haves.truths && !Array.isArray(frontmatter.must_haves.truths)) {
        errors.push('must_haves.truths debe ser un array');
      }
      if (frontmatter.must_haves.artifacts && !Array.isArray(frontmatter.must_haves.artifacts)) {
        errors.push('must_haves.artifacts debe ser un array');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Serializa frontmatter a YAML
   */
  serializeFrontmatter(frontmatter: PlanFrontmatter): string {
    const obj: any = {
      phase: frontmatter.phase,
      plan: frontmatter.plan,
      type: frontmatter.type,
      wave: frontmatter.wave,
    };
    
    if (frontmatter.depends_on.length > 0) {
      obj.depends_on = frontmatter.depends_on;
    }
    if (frontmatter.files_modified.length > 0) {
      obj.files_modified = frontmatter.files_modified;
    }
    if (!frontmatter.autonomous) {
      obj.autonomous = false;
    }
    if (frontmatter.requirements.length > 0) {
      obj.requirements = frontmatter.requirements;
    }
    if (frontmatter.user_setup) {
      obj.user_setup = frontmatter.user_setup;
    }
    if (frontmatter.dashboard_config) {
      obj.dashboard_config = frontmatter.dashboard_config;
    }
    if (frontmatter.must_haves) {
      obj.must_haves = frontmatter.must_haves;
    }
    
    return yaml.stringify(obj);
  }
  
  /**
   * Serializa tareas a XML
   */
  serializeTasks(tasks: PlanTask[]): string {
    return tasks.map(task => {
      let attrs = `type="${task.type}"`;
      if (task.tdd) attrs += ' tdd="true"';
      
      let xml = `<task ${attrs}>\n`;
      xml += `  <name>${task.name}</name>\n`;
      if (task.files) {
        xml += `  <files>${task.files.join(', ')}</files>\n`;
      }
      xml += `  <action>${task.action}</action>\n`;
      if (task.verify) {
        xml += `  <verify>${task.verify}</verify>\n`;
      }
      if (task.done) {
        xml += `  <done>${task.done}</done>\n`;
      }
      xml += `</task>`;
      
      return xml;
    }).join('\n\n');
  }
}
