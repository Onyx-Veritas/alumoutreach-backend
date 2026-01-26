import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { WorkflowGraph, WorkflowNode, WorkflowEdge } from '../entities/workflow.entity';
import { WorkflowNodeType } from '../entities/workflow.enums';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  nodeId?: string;
}

@Injectable()
export class WorkflowGraphValidator {
  constructor(private readonly logger: AppLoggerService) {}

  validate(graph: WorkflowGraph): ValidationResult {
    const startTime = this.logger.logOperationStart('WorkflowGraphValidator.validate', { 
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    });

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic structure validation
    this.validateBasicStructure(graph, errors);
    
    // Node validation
    this.validateNodes(graph, errors, warnings);
    
    // Edge validation
    this.validateEdges(graph, errors, warnings);
    
    // Graph connectivity validation
    this.validateConnectivity(graph, errors, warnings);
    
    // Node-specific validation
    this.validateNodeConfigs(graph, errors, warnings);

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
    };

    this.logger.logOperationEnd('WorkflowGraphValidator.validate', startTime, {
      isValid: result.isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
    });

    return result;
  }

  private validateBasicStructure(graph: WorkflowGraph, errors: ValidationError[]): void {
    if (!graph.nodes || !Array.isArray(graph.nodes)) {
      errors.push({
        code: 'INVALID_NODES',
        message: 'Graph must contain a nodes array',
      });
      return;
    }

    if (!graph.edges || !Array.isArray(graph.edges)) {
      errors.push({
        code: 'INVALID_EDGES',
        message: 'Graph must contain an edges array',
      });
      return;
    }

    if (graph.nodes.length === 0) {
      errors.push({
        code: 'EMPTY_GRAPH',
        message: 'Workflow must contain at least one node',
      });
    }
  }

  private validateNodes(graph: WorkflowGraph, errors: ValidationError[], warnings: ValidationWarning[]): void {
    const nodeIds = new Set<string>();
    let startNodeCount = 0;
    let endNodeCount = 0;

    for (const node of graph.nodes) {
      // Check for duplicate IDs
      if (nodeIds.has(node.id)) {
        errors.push({
          code: 'DUPLICATE_NODE_ID',
          message: `Duplicate node ID: ${node.id}`,
          nodeId: node.id,
        });
      }
      nodeIds.add(node.id);

      // Validate node type
      if (!Object.values(WorkflowNodeType).includes(node.type as WorkflowNodeType)) {
        errors.push({
          code: 'INVALID_NODE_TYPE',
          message: `Invalid node type: ${node.type}`,
          nodeId: node.id,
        });
      }

      // Count start/end nodes
      if (node.type === WorkflowNodeType.START) {
        startNodeCount++;
      }
      if (node.type === WorkflowNodeType.END) {
        endNodeCount++;
      }

      // Validate position
      if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        warnings.push({
          code: 'INVALID_POSITION',
          message: 'Node has invalid or missing position',
          nodeId: node.id,
        });
      }
    }

    // Validate start node
    if (startNodeCount === 0) {
      errors.push({
        code: 'NO_START_NODE',
        message: 'Workflow must have exactly one START node',
      });
    } else if (startNodeCount > 1) {
      errors.push({
        code: 'MULTIPLE_START_NODES',
        message: 'Workflow must have exactly one START node',
      });
    }

    // Validate end node (warning only)
    if (endNodeCount === 0) {
      warnings.push({
        code: 'NO_END_NODE',
        message: 'Workflow should have at least one END node for proper termination',
      });
    }
  }

  private validateEdges(graph: WorkflowGraph, errors: ValidationError[], warnings: ValidationWarning[]): void {
    const nodeIds = new Set(graph.nodes.map(n => n.id));
    const edgeIds = new Set<string>();

    for (const edge of graph.edges) {
      // Check for duplicate edge IDs
      if (edgeIds.has(edge.id)) {
        errors.push({
          code: 'DUPLICATE_EDGE_ID',
          message: `Duplicate edge ID: ${edge.id}`,
        });
      }
      edgeIds.add(edge.id);

      // Validate source node exists
      if (!nodeIds.has(edge.source)) {
        errors.push({
          code: 'INVALID_EDGE_SOURCE',
          message: `Edge references non-existent source node: ${edge.source}`,
        });
      }

      // Validate target node exists
      if (!nodeIds.has(edge.target)) {
        errors.push({
          code: 'INVALID_EDGE_TARGET',
          message: `Edge references non-existent target node: ${edge.target}`,
        });
      }

      // Check for self-loops
      if (edge.source === edge.target) {
        errors.push({
          code: 'SELF_LOOP',
          message: `Edge creates a self-loop on node: ${edge.source}`,
        });
      }
    }
  }

  private validateConnectivity(graph: WorkflowGraph, errors: ValidationError[], warnings: ValidationWarning[]): void {
    const nodeIds = new Set(graph.nodes.map(n => n.id));
    const incomingEdges = new Map<string, number>();
    const outgoingEdges = new Map<string, WorkflowEdge[]>();

    // Initialize maps
    for (const nodeId of nodeIds) {
      incomingEdges.set(nodeId, 0);
      outgoingEdges.set(nodeId, []);
    }

    // Count edges
    for (const edge of graph.edges) {
      if (nodeIds.has(edge.target)) {
        incomingEdges.set(edge.target, (incomingEdges.get(edge.target) || 0) + 1);
      }
      if (nodeIds.has(edge.source)) {
        outgoingEdges.get(edge.source)?.push(edge);
      }
    }

    // Check connectivity
    for (const node of graph.nodes) {
      const incoming = incomingEdges.get(node.id) || 0;
      const outgoing = outgoingEdges.get(node.id)?.length || 0;

      // START node should have no incoming edges
      if (node.type === WorkflowNodeType.START && incoming > 0) {
        errors.push({
          code: 'START_HAS_INCOMING',
          message: 'START node should not have incoming edges',
          nodeId: node.id,
        });
      }

      // END node should have no outgoing edges
      if (node.type === WorkflowNodeType.END && outgoing > 0) {
        errors.push({
          code: 'END_HAS_OUTGOING',
          message: 'END node should not have outgoing edges',
          nodeId: node.id,
        });
      }

      // Non-START nodes should have at least one incoming edge
      if (node.type !== WorkflowNodeType.START && incoming === 0) {
        warnings.push({
          code: 'ORPHAN_NODE',
          message: 'Node has no incoming edges and is unreachable',
          nodeId: node.id,
        });
      }

      // Non-END nodes should have at least one outgoing edge (except condition nodes which are handled separately)
      if (node.type !== WorkflowNodeType.END && 
          node.type !== WorkflowNodeType.CONDITION && 
          outgoing === 0) {
        warnings.push({
          code: 'DEAD_END_NODE',
          message: 'Node has no outgoing edges',
          nodeId: node.id,
        });
      }
    }

    // Check for cycles (basic DFS)
    const hasCycle = this.detectCycle(graph);
    if (hasCycle) {
      warnings.push({
        code: 'POTENTIAL_CYCLE',
        message: 'Workflow may contain cycles. Ensure proper exit conditions.',
      });
    }
  }

  private detectCycle(graph: WorkflowGraph): boolean {
    const nodeIds = graph.nodes.map(n => n.id);
    const adjacency = new Map<string, string[]>();
    
    for (const nodeId of nodeIds) {
      adjacency.set(nodeId, []);
    }
    
    for (const edge of graph.edges) {
      adjacency.get(edge.source)?.push(edge.target);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      for (const neighbor of adjacency.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) return true;
      }
    }

    return false;
  }

  private validateNodeConfigs(graph: WorkflowGraph, errors: ValidationError[], warnings: ValidationWarning[]): void {
    for (const node of graph.nodes) {
      switch (node.type) {
        case WorkflowNodeType.SEND_MESSAGE:
          this.validateSendMessageNode(node, errors);
          break;
        case WorkflowNodeType.CONDITION:
          this.validateConditionNode(node, graph, errors);
          break;
        case WorkflowNodeType.DELAY:
          this.validateDelayNode(node, errors);
          break;
        case WorkflowNodeType.UPDATE_ATTRIBUTE:
          this.validateUpdateAttributeNode(node, errors);
          break;
      }
    }
  }

  private validateSendMessageNode(node: WorkflowNode, errors: ValidationError[]): void {
    const data = node.data as Record<string, unknown>;
    
    if (!data.channel) {
      errors.push({
        code: 'MISSING_CHANNEL',
        message: 'SendMessage node must specify a channel',
        nodeId: node.id,
        field: 'channel',
      });
    }

    if (!data.templateId) {
      errors.push({
        code: 'MISSING_TEMPLATE',
        message: 'SendMessage node must specify a template',
        nodeId: node.id,
        field: 'templateId',
      });
    }
  }

  private validateConditionNode(node: WorkflowNode, graph: WorkflowGraph, errors: ValidationError[]): void {
    const data = node.data as Record<string, unknown>;
    const conditions = data.conditions as Array<{ field?: string; operator?: string; nextNodeId?: string }>;

    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      errors.push({
        code: 'MISSING_CONDITIONS',
        message: 'Condition node must have at least one condition',
        nodeId: node.id,
        field: 'conditions',
      });
      return;
    }

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      
      if (!condition.field) {
        errors.push({
          code: 'MISSING_CONDITION_FIELD',
          message: `Condition ${i + 1} must specify a field`,
          nodeId: node.id,
          field: `conditions[${i}].field`,
        });
      }

      if (!condition.operator) {
        errors.push({
          code: 'MISSING_CONDITION_OPERATOR',
          message: `Condition ${i + 1} must specify an operator`,
          nodeId: node.id,
          field: `conditions[${i}].operator`,
        });
      }

      if (!condition.nextNodeId) {
        errors.push({
          code: 'MISSING_CONDITION_NEXT_NODE',
          message: `Condition ${i + 1} must specify a next node`,
          nodeId: node.id,
          field: `conditions[${i}].nextNodeId`,
        });
      } else {
        // Verify the next node exists
        const nodeExists = graph.nodes.some(n => n.id === condition.nextNodeId);
        if (!nodeExists) {
          errors.push({
            code: 'INVALID_CONDITION_NEXT_NODE',
            message: `Condition ${i + 1} references non-existent node: ${condition.nextNodeId}`,
            nodeId: node.id,
            field: `conditions[${i}].nextNodeId`,
          });
        }
      }
    }
  }

  private validateDelayNode(node: WorkflowNode, errors: ValidationError[]): void {
    const data = node.data as Record<string, unknown>;
    
    if (typeof data.duration !== 'number' || data.duration <= 0) {
      errors.push({
        code: 'INVALID_DELAY_DURATION',
        message: 'Delay node must have a positive duration',
        nodeId: node.id,
        field: 'duration',
      });
    }

    if (!data.unit || !['minutes', 'hours', 'days'].includes(data.unit as string)) {
      errors.push({
        code: 'INVALID_DELAY_UNIT',
        message: 'Delay node must specify a valid unit (minutes, hours, days)',
        nodeId: node.id,
        field: 'unit',
      });
    }
  }

  private validateUpdateAttributeNode(node: WorkflowNode, errors: ValidationError[]): void {
    const data = node.data as Record<string, unknown>;
    
    if (!data.attributeName || typeof data.attributeName !== 'string') {
      errors.push({
        code: 'MISSING_ATTRIBUTE_NAME',
        message: 'UpdateAttribute node must specify an attribute name',
        nodeId: node.id,
        field: 'attributeName',
      });
    }

    if (data.attributeValue === undefined) {
      errors.push({
        code: 'MISSING_ATTRIBUTE_VALUE',
        message: 'UpdateAttribute node must specify an attribute value',
        nodeId: node.id,
        field: 'attributeValue',
      });
    }
  }
}
