export default function (plop) {
  plop.setGenerator('controller', {
    description: 'application controller logic',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Lambda Name (UpperCamelCase)'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Lambda Description (1-Sentence)'
      }
    ],
    actions: [
      {
        type: 'add',
        path: 'terraform/{{snakeCase name}}.tf',
        templateFile: './plop/templates/lambda-scheduled-terraform.hbs'
      },
      {
        type: 'add',
        path: 'src/lambdas/{{properCase/pascalCase name}}/src/index.ts',
        templateFile: './plop/templates/lambda-scheduled-src-index.hbs'
      },
      {
        type: 'add',
        path: 'src/lambdas/{{properCase/pascalCase name}}/test/index.ts',
        templateFile: './plop/templates/lambda-scheduled-test-index.hbs'
      }
    ]
  })
}
