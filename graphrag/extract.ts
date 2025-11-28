#!/usr/bin/env node
/**
 * GraphRAG extraction for Lambda chains and entity relationships
 * Builds a knowledge graph from the codebase for multi-hop reasoning
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Node {
  id: string;
  type: 'Lambda' | 'Entity' | 'Service' | 'External';
  properties: Record<string, any>;
}

interface Edge {
  source: string;
  target: string;
  relationship: string;
  properties?: Record<string, any>;
}

interface KnowledgeGraph {
  nodes: Node[];
  edges: Edge[];
  metadata: {
    created: string;
    version: string;
    description: string;
  };
}

/**
 * Extract knowledge graph from codebase
 */
export async function extractKnowledgeGraph(): Promise<KnowledgeGraph> {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // 1. Add Lambda nodes
  const lambdas = [
    { name: 'ListFiles', trigger: 'API Gateway', purpose: 'List user files' },
    { name: 'LoginUser', trigger: 'API Gateway', purpose: 'Authenticate user' },
    { name: 'RegisterDevice', trigger: 'API Gateway', purpose: 'Register device for push' },
    { name: 'StartFileUpload', trigger: 'API Gateway', purpose: 'Initiate upload' },
    { name: 'WebhookFeedly', trigger: 'API Gateway', purpose: 'Process Feedly articles' },
    { name: 'FileCoordinator', trigger: 'S3 Event', purpose: 'Orchestrate processing' },
    { name: 'DownloadMedia', trigger: 'Step Functions', purpose: 'Download media' },
    { name: 'CreateThumbnail', trigger: 'Step Functions', purpose: 'Generate thumbnail' },
    { name: 'SendPushNotification', trigger: 'Lambda Invoke', purpose: 'Send push' },
    { name: 'PruneDevices', trigger: 'CloudWatch Events', purpose: 'Clean devices' },
    { name: 'UserDelete', trigger: 'API Gateway', purpose: 'Delete user cascade' },
  ];

  for (const lambda of lambdas) {
    nodes.push({
      id: `lambda:${lambda.name}`,
      type: 'Lambda',
      properties: lambda,
    });
  }

  // 2. Add Entity nodes
  const entities = ['Users', 'Files', 'Devices', 'UserFiles', 'UserDevices'];
  for (const entity of entities) {
    nodes.push({
      id: `entity:${entity}`,
      type: 'Entity',
      properties: { name: entity },
    });
  }

  // 3. Add Service nodes
  const services = [
    { name: 'DynamoDB', type: 'database' },
    { name: 'S3', type: 'storage' },
    { name: 'SNS', type: 'notification' },
    { name: 'API Gateway', type: 'api' },
    { name: 'Step Functions', type: 'orchestration' },
    { name: 'CloudWatch', type: 'monitoring' },
  ];

  for (const service of services) {
    nodes.push({
      id: `service:${service.name}`,
      type: 'Service',
      properties: service,
    });
  }

  // 4. Add External service nodes
  const external = ['Feedly', 'YouTube', 'APNS', 'Sign In With Apple', 'GitHub'];
  for (const ext of external) {
    nodes.push({
      id: `external:${ext}`,
      type: 'External',
      properties: { name: ext },
    });
  }

  // 5. Define Lambda → Service edges
  const lambdaServices: Record<string, string[]> = {
    ListFiles: ['DynamoDB', 'API Gateway'],
    LoginUser: ['DynamoDB', 'API Gateway', 'Sign In With Apple'],
    RegisterDevice: ['DynamoDB', 'SNS', 'API Gateway'],
    StartFileUpload: ['DynamoDB', 'S3', 'API Gateway'],
    WebhookFeedly: ['DynamoDB', 'S3', 'API Gateway', 'Feedly', 'YouTube'],
    FileCoordinator: ['DynamoDB', 'Step Functions', 'S3'],
    DownloadMedia: ['S3', 'YouTube'],
    CreateThumbnail: ['S3'],
    SendPushNotification: ['SNS', 'APNS'],
    PruneDevices: ['DynamoDB', 'SNS', 'CloudWatch'],
    UserDelete: ['DynamoDB', 'S3', 'API Gateway'],
  };

  for (const [lambda, services] of Object.entries(lambdaServices)) {
    for (const service of services) {
      const targetType = external.includes(service) ? 'external' : 'service';
      edges.push({
        source: `lambda:${lambda}`,
        target: `${targetType}:${service}`,
        relationship: 'uses',
      });
    }
  }

  // 6. Define Lambda → Lambda edges (invocations)
  edges.push({
    source: 'lambda:FileCoordinator',
    target: 'lambda:DownloadMedia',
    relationship: 'invokes',
    properties: { via: 'Step Functions' },
  });

  edges.push({
    source: 'lambda:FileCoordinator',
    target: 'lambda:CreateThumbnail',
    relationship: 'invokes',
    properties: { via: 'Step Functions' },
  });

  edges.push({
    source: 'lambda:DownloadMedia',
    target: 'lambda:SendPushNotification',
    relationship: 'invokes',
    properties: { trigger: 'on_success' },
  });

  edges.push({
    source: 'lambda:CreateThumbnail',
    target: 'lambda:SendPushNotification',
    relationship: 'invokes',
    properties: { trigger: 'on_complete' },
  });

  // 7. Define Lambda → Entity edges
  const lambdaEntities: Record<string, string[]> = {
    ListFiles: ['Users', 'UserFiles', 'Files'],
    LoginUser: ['Users'],
    RegisterDevice: ['Users', 'Devices', 'UserDevices'],
    StartFileUpload: ['Users', 'Files', 'UserFiles'],
    WebhookFeedly: ['Files'],
    FileCoordinator: ['Files'],
    PruneDevices: ['Devices', 'UserDevices'],
    UserDelete: ['Users', 'UserFiles', 'UserDevices', 'Files', 'Devices'],
  };

  for (const [lambda, entities] of Object.entries(lambdaEntities)) {
    for (const entity of entities) {
      edges.push({
        source: `lambda:${lambda}`,
        target: `entity:${entity}`,
        relationship: 'accesses',
      });
    }
  }

  // 8. Define Entity → Entity relationships
  edges.push({
    source: 'entity:Users',
    target: 'entity:UserFiles',
    relationship: 'has_many',
  });

  edges.push({
    source: 'entity:Users',
    target: 'entity:UserDevices',
    relationship: 'has_many',
  });

  edges.push({
    source: 'entity:Files',
    target: 'entity:UserFiles',
    relationship: 'has_many',
  });

  edges.push({
    source: 'entity:Devices',
    target: 'entity:UserDevices',
    relationship: 'has_many',
  });

  edges.push({
    source: 'entity:UserFiles',
    target: 'entity:Users',
    relationship: 'belongs_to',
  });

  edges.push({
    source: 'entity:UserFiles',
    target: 'entity:Files',
    relationship: 'belongs_to',
  });

  edges.push({
    source: 'entity:UserDevices',
    target: 'entity:Users',
    relationship: 'belongs_to',
  });

  edges.push({
    source: 'entity:UserDevices',
    target: 'entity:Devices',
    relationship: 'belongs_to',
  });

  // 9. Service → Service edges
  edges.push({
    source: 'service:API Gateway',
    target: 'service:Lambda',
    relationship: 'triggers',
  });

  edges.push({
    source: 'service:S3',
    target: 'service:Lambda',
    relationship: 'triggers',
    properties: { event: 's3:ObjectCreated' },
  });

  edges.push({
    source: 'service:CloudWatch',
    target: 'service:Lambda',
    relationship: 'triggers',
    properties: { event: 'scheduled' },
  });

  return {
    nodes,
    edges,
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0',
      description: 'Media Downloader Lambda chains and entity relationships',
    },
  };
}

/**
 * Save knowledge graph to file
 */
async function saveKnowledgeGraph(graph: KnowledgeGraph, outputPath: string) {
  await fs.writeFile(outputPath, JSON.stringify(graph, null, 2));
  console.log(`✓ Knowledge graph saved to ${outputPath}`);
  console.log(`  Nodes: ${graph.nodes.length}`);
  console.log(`  Edges: ${graph.edges.length}`);
}

/**
 * Generate graph statistics
 */
function analyzeGraph(graph: KnowledgeGraph) {
  const stats = {
    nodeTypes: {} as Record<string, number>,
    relationshipTypes: {} as Record<string, number>,
    mostConnected: [] as Array<{ node: string; connections: number }>,
    lambdaChains: [] as string[][],
  };

  // Count node types
  for (const node of graph.nodes) {
    stats.nodeTypes[node.type] = (stats.nodeTypes[node.type] || 0) + 1;
  }

  // Count relationship types
  for (const edge of graph.edges) {
    stats.relationshipTypes[edge.relationship] = (stats.relationshipTypes[edge.relationship] || 0) + 1;
  }

  // Find most connected nodes
  const connections: Record<string, number> = {};
  for (const edge of graph.edges) {
    connections[edge.source] = (connections[edge.source] || 0) + 1;
    connections[edge.target] = (connections[edge.target] || 0) + 1;
  }

  stats.mostConnected = Object.entries(connections)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([node, count]) => ({ node, connections: count }));

  // Find Lambda chains
  const findChains = (start: string, visited: Set<string> = new Set()): string[][] => {
    if (visited.has(start)) return [];
    visited.add(start);

    const chains: string[][] = [];
    const outgoing = graph.edges.filter((e) => e.source === start && e.relationship === 'invokes');

    if (outgoing.length === 0) {
      return [[start]];
    }

    for (const edge of outgoing) {
      const subChains = findChains(edge.target, new Set(visited));
      for (const subChain of subChains) {
        chains.push([start, ...subChain]);
      }
    }

    return chains;
  };

  // Find all Lambda invocation chains
  const lambdaNodes = graph.nodes.filter((n) => n.type === 'Lambda').map((n) => n.id);
  for (const lambda of lambdaNodes) {
    const chains = findChains(lambda);
    if (chains.length > 0 && chains.some((c) => c.length > 1)) {
      stats.lambdaChains.push(...chains.filter((c) => c.length > 1));
    }
  }

  return stats;
}

// Main execution
async function main() {
  try {
    console.log('Extracting knowledge graph...');
    const graph = await extractKnowledgeGraph();

    const outputPath = path.join(__dirname, 'knowledge-graph.json');
    await saveKnowledgeGraph(graph, outputPath);

    console.log('\nGraph Statistics:');
    const stats = analyzeGraph(graph);
    console.log('Node Types:', stats.nodeTypes);
    console.log('Relationship Types:', stats.relationshipTypes);
    console.log('\nMost Connected Nodes:');
    stats.mostConnected.forEach((item) => {
      console.log(`  ${item.node}: ${item.connections} connections`);
    });

    console.log('\nLambda Invocation Chains:');
    stats.lambdaChains.forEach((chain) => {
      console.log('  ' + chain.join(' → '));
    });
  } catch (error) {
    console.error('Error extracting knowledge graph:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${__filename}`) {
  main();
}

export { KnowledgeGraph, Node, Edge };