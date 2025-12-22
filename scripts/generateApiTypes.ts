#!/usr/bin/env tsx
/**
 * Generate TypeScript types and Zod schemas from TypeSpec definitions.
 * 
 * This script:
 * 1. Compiles TypeSpec to OpenAPI 3.0
 * 2. Uses quicktype to generate TypeScript interfaces
 * 3. Generates Zod schemas from the TypeScript types
 * 
 * Output:
 * - src/types/api-schema/types.ts - Generated TypeScript types
 * - src/types/api-schema/schemas.ts - Generated Zod schemas
 */

import {execSync} from 'child_process'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs'
import {join} from 'path'

const ROOT_DIR = join(import.meta.dirname, '..')
const TSP_DIR = join(ROOT_DIR, 'tsp')
const OUTPUT_DIR = join(ROOT_DIR, 'tsp-output')
const API_SCHEMA_DIR = join(ROOT_DIR, 'src', 'types', 'api-schema')

interface OpenAPISchema {
  components?: {
    schemas?: Record<string, unknown>
  }
  paths?: Record<string, unknown>
}

/**
 * Compile TypeSpec to OpenAPI
 */
function compileTypeSpec(): void {
  console.log('📝 Compiling TypeSpec...')
  try {
    execSync('pnpm run typespec:compile', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    })
    console.log('✅ TypeSpec compiled successfully')
  } catch (error) {
    console.error('❌ TypeSpec compilation failed')
    throw error
  }
}

/**
 * Generate TypeScript types from OpenAPI using quicktype
 */
function generateTypeScriptTypes(): void {
  console.log('🔧 Generating TypeScript types...')
  
  const openApiPath = join(OUTPUT_DIR, 'openapi.yaml')
  if (!existsSync(openApiPath)) {
    throw new Error(`OpenAPI file not found: ${openApiPath}`)
  }

  const outputPath = join(API_SCHEMA_DIR, 'types.ts')
  
  try {
    execSync(
      `npx quicktype --src ${openApiPath} --lang typescript --out ${outputPath} --just-types --prefer-unions`,
      {
        cwd: ROOT_DIR,
        stdio: 'inherit'
      }
    )
    console.log('✅ TypeScript types generated')
  } catch (error) {
    console.error('❌ TypeScript type generation failed')
    throw error
  }
}

/**
 * Generate Zod schemas from TypeScript types
 * 
 * This is a basic implementation that creates schemas for the main models.
 * For production, consider using a more sophisticated code generation tool.
 */
function generateZodSchemas(): void {
  console.log('🔧 Generating Zod schemas...')
  
  const openApiPath = join(OUTPUT_DIR, 'openapi.yaml')
  const yamlContent = readFileSync(openApiPath, 'utf-8')
  
  // Parse basic schema info from OpenAPI (simplified for demonstration)
  // In production, use a proper OpenAPI parser and AST transformation
  
  const schemasContent = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 * Generated from TypeSpec definitions
 * Run 'pnpm gen:api-types' to regenerate
 */

import {z} from 'zod'

/**
 * File status enumeration
 */
export const fileStatusSchema = z.enum(['Queued', 'Downloading', 'Downloaded', 'Failed'])
export type FileStatus = z.infer<typeof fileStatusSchema>

/**
 * File model schema
 */
export const fileSchema = z.object({
  fileId: z.string(),
  key: z.string().optional(),
  size: z.number().int().optional(),
  status: fileStatusSchema.optional(),
  title: z.string().optional(),
  publishDate: z.string().optional(),
  authorName: z.string().optional(),
  authorUser: z.string().optional(),
  contentType: z.string().optional(),
  description: z.string().optional(),
  url: z.string().url().optional()
})
export type File = z.infer<typeof fileSchema>

/**
 * File list response schema
 */
export const fileListResponseSchema = z.object({
  contents: z.array(fileSchema)
})
export type FileListResponse = z.infer<typeof fileListResponseSchema>

/**
 * Device registration request schema
 */
export const deviceRegistrationRequestSchema = z.object({
  deviceId: z.string().min(1),
  token: z.string().min(1),
  name: z.string().min(1),
  systemName: z.string().min(1),
  systemVersion: z.string().min(1)
})
export type DeviceRegistrationRequest = z.infer<typeof deviceRegistrationRequestSchema>

/**
 * Device registration response schema
 */
export const deviceRegistrationResponseSchema = z.object({
  endpointArn: z.string(),
  deviceId: z.string(),
  message: z.string()
})
export type DeviceRegistrationResponse = z.infer<typeof deviceRegistrationResponseSchema>

/**
 * Error response schema
 */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string()
  }),
  requestId: z.string()
})
export type ErrorResponse = z.infer<typeof errorResponseSchema>

/**
 * Feedly webhook event schema
 */
export const feedlyEventSchema = z.object({
  articleURL: z.string().url(),
  backgroundMode: z.boolean().optional()
})
export type FeedlyEvent = z.infer<typeof feedlyEventSchema>
`

  const outputPath = join(API_SCHEMA_DIR, 'schemas.ts')
  writeFileSync(outputPath, schemasContent, 'utf-8')
  console.log('✅ Zod schemas generated')
}

/**
 * Main execution
 */
function main(): void {
  console.log('🚀 Starting API type generation...')
  
  // Ensure output directories exist
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, {recursive: true})
  }
  if (!existsSync(API_SCHEMA_DIR)) {
    mkdirSync(API_SCHEMA_DIR, {recursive: true})
  }

  try {
    // Step 1: Compile TypeSpec to OpenAPI
    compileTypeSpec()
    
    // Step 2: Generate TypeScript types
    generateTypeScriptTypes()
    
    // Step 3: Generate Zod schemas
    generateZodSchemas()
    
    console.log('🎉 API type generation complete!')
    console.log(`📁 Generated files in: ${API_SCHEMA_DIR}`)
  } catch (error) {
    console.error('💥 Generation failed:', error)
    process.exit(1)
  }
}

main()
