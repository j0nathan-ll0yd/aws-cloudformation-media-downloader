import { Project, SyntaxKind } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
  skipFileDependencyResolution: true
});

const files = project.getSourceFiles("src/**/*.ts");

const graph = {
  nodes: [],
  edges: []
};

for (const file of files) {
  const filePath = file.getFilePath();
  graph.nodes.push({ id: filePath, type: "file" });

  const functionsCalled = new Set();

  file.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const expression = node.getExpression();
      const symbol = expression.getSymbol();

      if (symbol) {
        const declarations = symbol.getDeclarations();
        const decl = declarations?.[0];
        const declFile = decl?.getSourceFile().getFilePath();
        const name = symbol.getName();

        if (declFile && !declFile.includes("node_modules")) {
          const funcId = `${name}@${declFile}`;
          functionsCalled.add(funcId);
          graph.nodes.push({ id: funcId, type: "function", definedIn: declFile });
          graph.edges.push({ from: filePath, to: funcId, type: "calls" });
        }
      }
    }
  });
}

console.log(JSON.stringify(graph, null, 2));

