/**
 * API Registry Types
 *
 * Shared types for the centralized API endpoint registry.
 * Used by ApiReferenceModal and any future consumers.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type AuthType = 'bearer' | 'session' | 'none'

export interface EndpointParam {
  name: string
  in: 'path' | 'query' | 'body'
  type: string
  required: boolean
  description: string
}

export interface EndpointDef {
  method: HttpMethod
  path: string
  title: string
  description: string
  auth: AuthType
  scope?: string
  params?: EndpointParam[]
  bodyExample?: string
}

export interface SectionDef {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  endpoints: EndpointDef[]
}
